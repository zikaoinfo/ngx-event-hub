/**
 * Row models: client-side, server-side (paged block cache) and infinite scroll.
 *
 * Also owns: transactions with undo/redo, immutable-data reconciliation,
 * row pinning, group expansion state, and the processed-row pipeline
 * (filter → sort → group/flatten) as a single computed signal.
 */
import { DestroyRef, Injectable, Signal, computed, inject, isSignal, signal } from '@angular/core';
import { Observable, Subscription, isObservable } from 'rxjs';
import { ColumnDef, FilterModel, SortModelEntry, colIdOf } from '../types/column-def.types';
import {
  GetRowsParams,
  GetRowsResult,
  GroupingOptions,
  RowDataInput,
  TreeDataOptions,
  ZenDatasource,
  RowModelType,
} from '../types/grid-options.types';
import {
  GetRowIdFn,
  RowId,
  RowNode,
  RowPinned,
  RowTransaction,
  RowTransactionResult,
} from '../types/row-node.types';
import { SortFilterEngine } from './sort-filter.engine';
import { flattenTree, groupAndFlatten, groupPathOf } from './aggregation.engine';

interface UndoEntry<T extends object> {
  /** Applying this transaction reverses the original one. */
  inverse: RowTransaction<T>;
  redo: RowTransaction<T>;
}

@Injectable()
export class DataSourceService<T extends object = object> {
  private readonly sortFilter = inject(SortFilterEngine<T>);
  private readonly destroyRef = inject(DestroyRef);

  // ── Configuration ──────────────────────────────────────────────
  private mode: RowModelType = 'client';

  /** The active row model. */
  get rowModelType(): RowModelType {
    return this.mode;
  }

  private datasource: ZenDatasource<T> | null = null;
  private getRowIdFn: GetRowIdFn<T> | null = null;
  private immutable = false;
  private blockSize = 100;
  private maxBlocks = 10;
  private grouping: GroupingOptions = {};
  private treeData: TreeDataOptions<T> | null = null;

  /** Columns are pushed in by the grid component whenever defs change. */
  readonly columns = signal<readonly ColumnDef<T>[]>([]);

  // ── Raw data ───────────────────────────────────────────────────
  readonly rawRows = signal<readonly T[]>([]);
  readonly loading = signal(false);
  /** Known total (server/infinite); -1 = unknown. */
  readonly serverTotalCount = signal(-1);
  /** Bumped whenever server blocks change so computeds refresh. */
  private readonly blockVersion = signal(0);

  private rowDataSub: Subscription | null = null;
  private nodeCache = new Map<RowId, RowNode<T>>();
  private blocks = new Map<number, readonly T[]>();
  private blockOrder: number[] = []; // LRU
  private pendingBlocks = new Set<number>();
  /** Infinite model: rows appended so far. */
  private infiniteExhausted = false;

  // ── Pinned rows & expansion state ──────────────────────────────
  readonly pinnedTopRows = signal<readonly T[]>([]);
  readonly pinnedBottomRows = signal<readonly T[]>([]);
  /** Expanded group paths (or "!" + path for explicitly collapsed). */
  readonly expandedGroups = signal<ReadonlySet<string>>(new Set());
  /** Expanded tree/detail row ids. */
  readonly expandedRowIds = signal<ReadonlySet<RowId>>(new Set());
  readonly detailExpandedIds = signal<ReadonlySet<RowId>>(new Set());

  // ── Undo/redo ──────────────────────────────────────────────────
  private undoStack: UndoEntry<T>[] = [];
  private redoStack: UndoEntry<T>[] = [];
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  /** Cells changed by the most recent update — drives cell flashing. */
  readonly lastChangedCells = signal<ReadonlySet<string>>(new Set()); // `${rowId}|${colId}`

  // ── Processed pipeline ─────────────────────────────────────────

  /**
   * The fully processed, flattened row list rendered by the grid.
   * client mode: filter → sort → group/tree-flatten.
   * server/infinite: block cache materialized in order (sort/filter remote).
   */
  readonly processedRows: Signal<readonly RowNode<T>[]> = computed(() => {
    if (this.mode === 'client') return this.processClient();
    return this.processServer();
  });

  readonly totalRowCount: Signal<number> = computed(() => {
    if (this.mode === 'client') return this.processedRows().length;
    const known = this.serverTotalCount();
    if (known >= 0) return known;
    // Unknown total: current rows + 1 phantom block to keep scroll open.
    this.blockVersion();
    return this.infiniteExhausted ? this.loadedServerCount() : this.loadedServerCount() + this.blockSize;
  });

  // ── Setup ──────────────────────────────────────────────────────

  configure(opts: {
    rowModelType?: RowModelType;
    datasource?: ZenDatasource<T>;
    getRowId?: GetRowIdFn<T>;
    immutableData?: boolean;
    cacheBlockSize?: number;
    maxBlocksInCache?: number;
    grouping?: GroupingOptions;
    treeData?: TreeDataOptions<T>;
  }): void {
    this.mode = opts.rowModelType ?? 'client';
    this.datasource = opts.datasource ?? null;
    this.getRowIdFn = opts.getRowId ?? null;
    this.immutable = opts.immutableData ?? false;
    this.blockSize = opts.cacheBlockSize ?? 100;
    this.maxBlocks = opts.maxBlocksInCache ?? 10;
    this.grouping = opts.grouping ?? {};
    this.treeData = opts.treeData ?? null;
    if (this.mode !== 'client' && !this.datasource) {
      throw new Error(`[ZenGrid] rowModelType '${this.mode}' requires a datasource.`);
    }
  }

  /** Accepts T[], Signal<T[]> or Observable<T[]>. */
  setRowData(input: RowDataInput<T>): void {
    this.rowDataSub?.unsubscribe();
    this.rowDataSub = null;
    if (isSignal(input)) {
      // Mirror the external signal; effect-free polling is avoided by
      // having the component re-call setRowData via its own computed input.
      this.applyRowData(input());
    } else if (isObservable(input)) {
      this.rowDataSub = (input as Observable<readonly T[]>).subscribe((rows) =>
        this.applyRowData(rows),
      );
      this.destroyRef.onDestroy(() => this.rowDataSub?.unsubscribe());
    } else {
      this.applyRowData(input);
    }
  }

  private applyRowData(rows: readonly T[]): void {
    if (this.immutable && this.getRowIdFn) {
      // Immutable mode: keep RowNode identity for unchanged rows and record
      // changed cells for flashing.
      const changed = new Set<string>();
      const next = new Map<RowId, RowNode<T>>();
      const columns = this.columns();
      for (const row of rows) {
        const id = this.getRowIdFn(row);
        const prev = this.nodeCache.get(id);
        if (prev && prev.data === row) {
          next.set(id, prev);
        } else {
          if (prev) {
            for (const col of columns) {
              if (col.enableCellFlash === false) continue;
              if (this.sortFilter.valueOf(prev.data, col) !== this.sortFilter.valueOf(row, col)) {
                changed.add(`${String(id)}|${colIdOf(col)}`);
              }
            }
          }
          next.set(id, this.makeNode(row, id));
        }
      }
      this.nodeCache = next;
      if (changed.size > 0) this.lastChangedCells.set(changed);
    } else {
      this.nodeCache.clear();
    }
    this.rawRows.set(rows);
  }

  // ── Transactions ───────────────────────────────────────────────

  /** Add/update/remove rows; records the inverse on the undo stack. */
  applyTransaction(tx: RowTransaction<T>): RowTransactionResult<T> {
    const result = this.executeTransaction(tx);
    const inverse: RowTransaction<T> = {
      add: result.removed,
      remove: result.added,
      update: result.updated.map((updated) => {
        const id = this.idOf(updated);
        const before = this.txSnapshots.get(id);
        return before ?? updated;
      }),
    };
    this.undoStack.push({ inverse, redo: tx });
    this.redoStack = [];
    this.syncUndoFlags();
    return result;
  }

  undo(): void {
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.executeTransaction(entry.inverse);
    this.redoStack.push(entry);
    this.syncUndoFlags();
  }

  redo(): void {
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.executeTransaction(entry.redo);
    this.undoStack.push(entry);
    this.syncUndoFlags();
  }

  /** Pre-transaction snapshots of updated rows, keyed by id. */
  private txSnapshots = new Map<RowId, T>();

  private executeTransaction(tx: RowTransaction<T>): RowTransactionResult<T> {
    const rows = [...this.rawRows()];
    const byId = new Map(rows.map((r, i) => [this.idOf(r), i]));
    const added: T[] = [];
    const updated: T[] = [];
    const removed: T[] = [];
    const changed = new Set<string>();
    this.txSnapshots = new Map();
    const columns = this.columns();

    for (const row of tx.remove ?? []) {
      const idx = byId.get(this.idOf(row));
      if (idx !== undefined) {
        removed.push(rows[idx]);
        rows.splice(idx, 1);
        byId.delete(this.idOf(row));
        // Rebuild index map after splice (indices shifted).
        byId.clear();
        rows.forEach((r, i) => byId.set(this.idOf(r), i));
      }
    }
    for (const row of tx.update ?? []) {
      const id = this.idOf(row);
      const idx = byId.get(id);
      if (idx !== undefined) {
        this.txSnapshots.set(id, rows[idx]);
        for (const colDef of columns) {
          if (colDef.enableCellFlash === false) continue;
          if (this.sortFilter.valueOf(rows[idx], colDef) !== this.sortFilter.valueOf(row, colDef)) {
            changed.add(`${String(id)}|${colIdOf(colDef)}`);
          }
        }
        rows[idx] = row;
        this.nodeCache.delete(id);
        updated.push(row);
      }
    }
    if (tx.add && tx.add.length > 0) {
      const at = tx.addIndex ?? rows.length;
      rows.splice(at, 0, ...tx.add);
      added.push(...tx.add);
    }

    if (changed.size > 0) this.lastChangedCells.set(changed);
    this.rawRows.set(rows);
    return { added, updated, removed };
  }

  /** Patch a single cell value without a full re-render (partial row patch). */
  patchCell(rowId: RowId, patch: (row: T) => T): void {
    const row = this.rawRows().find((r) => this.idOf(r) === rowId);
    if (!row) return;
    this.applyTransaction({ update: [patch(row)] });
  }

  private syncUndoFlags(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  // ── Pinning & expansion ────────────────────────────────────────

  pinRow(row: T, pinned: RowPinned): void {
    const id = this.idOf(row);
    const without = (rows: readonly T[]): T[] => rows.filter((r) => this.idOf(r) !== id);
    this.pinnedTopRows.set(without(this.pinnedTopRows()));
    this.pinnedBottomRows.set(without(this.pinnedBottomRows()));
    if (pinned === 'top') this.pinnedTopRows.set([...this.pinnedTopRows(), row]);
    if (pinned === 'bottom') this.pinnedBottomRows.set([...this.pinnedBottomRows(), row]);
  }

  toggleGroup(node: RowNode<T>): void {
    const path = groupPathOf(node);
    const set = new Set(this.expandedGroups());
    if (node.expanded) {
      set.delete(path);
      set.add(`!${path}`);
    } else {
      set.delete(`!${path}`);
      set.add(path);
    }
    this.expandedGroups.set(set);
  }

  async toggleTreeRow(node: RowNode<T>): Promise<void> {
    const set = new Set(this.expandedRowIds());
    if (set.has(node.id)) {
      set.delete(node.id);
    } else {
      if (node.hasLazyChildren && this.treeData?.loadChildren) {
        this.loading.set(true);
        try {
          const children = await this.treeData.loadChildren(node.data);
          this.lazyChildren.set(node.id, children);
        } finally {
          this.loading.set(false);
        }
      }
      set.add(node.id);
    }
    this.expandedRowIds.set(set);
  }

  toggleDetail(node: RowNode<T>): void {
    const set = new Set(this.detailExpandedIds());
    if (set.has(node.id)) set.delete(node.id);
    else set.add(node.id);
    this.detailExpandedIds.set(set);
  }

  private lazyChildren = new Map<RowId, readonly T[]>();

  // ── Server / infinite row model ────────────────────────────────

  /** Called by the grid when the visible range changes. */
  ensureRange(startRow: number, endRow: number): void {
    if (this.mode === 'client' || !this.datasource) return;
    const firstBlock = Math.floor(startRow / this.blockSize);
    const lastBlock = Math.floor(Math.max(startRow, endRow - 1) / this.blockSize);
    for (let b = firstBlock; b <= lastBlock; b++) this.loadBlock(b);
  }

  /** Drop all cached blocks and reload (sort/filter changed, or api.refresh). */
  refreshServerSide(): void {
    this.blocks.clear();
    this.blockOrder = [];
    this.pendingBlocks.clear();
    this.infiniteExhausted = false;
    this.serverTotalCount.set(-1);
    this.blockVersion.update((v) => v + 1);
  }

  private loadBlock(blockIndex: number): void {
    if (this.blocks.has(blockIndex) || this.pendingBlocks.has(blockIndex)) return;
    if (this.mode === 'infinite' && this.infiniteExhausted) return;
    const ds = this.datasource;
    if (!ds) return;
    this.pendingBlocks.add(blockIndex);
    this.loading.set(true);

    const params: GetRowsParams = {
      startRow: blockIndex * this.blockSize,
      endRow: (blockIndex + 1) * this.blockSize,
      sortModel: this.sortFilter.sortModel(),
      filterModel: this.sortFilter.filterModel(),
      quickFilter: this.sortFilter.quickFilter(),
      groupKeys: [],
    };

    const handle = (result: GetRowsResult<T>): void => {
      this.pendingBlocks.delete(blockIndex);
      this.blocks.set(blockIndex, result.rows);
      this.touchBlock(blockIndex);
      if (result.totalRowCount !== undefined) {
        this.serverTotalCount.set(result.totalRowCount);
      } else if (result.rows.length < this.blockSize) {
        this.infiniteExhausted = true;
        this.serverTotalCount.set(blockIndex * this.blockSize + result.rows.length);
      }
      this.loading.set(this.pendingBlocks.size > 0);
      this.blockVersion.update((v) => v + 1);
    };

    const out = ds.getRows(params);
    if (isObservable(out)) {
      const sub = out.subscribe({
        next: handle,
        error: () => {
          this.pendingBlocks.delete(blockIndex);
          this.loading.set(this.pendingBlocks.size > 0);
        },
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    } else {
      out.then(handle).catch(() => {
        this.pendingBlocks.delete(blockIndex);
        this.loading.set(this.pendingBlocks.size > 0);
      });
    }
  }

  private touchBlock(blockIndex: number): void {
    this.blockOrder = this.blockOrder.filter((b) => b !== blockIndex);
    this.blockOrder.push(blockIndex);
    while (this.blockOrder.length > this.maxBlocks && this.mode === 'server') {
      const evict = this.blockOrder.shift();
      if (evict !== undefined) this.blocks.delete(evict);
    }
  }

  private loadedServerCount(): number {
    let max = 0;
    for (const [index, rows] of this.blocks) {
      max = Math.max(max, index * this.blockSize + rows.length);
    }
    return max;
  }

  // ── Pipeline internals ─────────────────────────────────────────

  private processClient(): readonly RowNode<T>[] {
    const columns = this.columns();
    const filtered = this.sortFilter.filter(
      this.rawRows(),
      this.sortFilter.filterModel(),
      this.sortFilter.quickFilter(),
      columns,
    );
    const sorted = this.sortFilter.sort(filtered, this.sortFilter.sortModel(), columns);

    let nodes = sorted.map((row, i) => this.nodeFor(row, i));

    if (this.treeData) {
      const tree = this.treeData;
      const getChildren = (row: T): readonly T[] | undefined =>
        tree.getChildren(row) ?? this.lazyChildren.get(this.idOf(row));
      nodes = flattenTree(
        nodes,
        this.expandedRowIds(),
        getChildren,
        tree.hasChildren,
        (row, level) => ({ ...this.nodeFor(row, -1), level }),
      );
    } else {
      const groupCols = columns
        .filter((c) => c.rowGroup)
        .sort((a, b) => (a.rowGroupIndex ?? 0) - (b.rowGroupIndex ?? 0));
      if (groupCols.length > 0) {
        nodes = groupAndFlatten(
          nodes,
          groupCols,
          columns,
          this.expandedGroups(),
          this.grouping.defaultExpanded ?? false,
        );
      }
    }

    const detailIds = this.detailExpandedIds();
    nodes.forEach((n, i) => {
      n.rowIndex = i;
      n.detailExpanded = detailIds.has(n.id);
    });
    return nodes;
  }

  private processServer(): readonly RowNode<T>[] {
    this.blockVersion();
    const total = this.totalRowCount();
    const nodes: RowNode<T>[] = [];
    for (let i = 0; i < total; i++) {
      const block = this.blocks.get(Math.floor(i / this.blockSize));
      const row = block?.[i % this.blockSize];
      if (row !== undefined) {
        const node = this.nodeFor(row, i);
        node.rowIndex = i;
        nodes.push(node);
      } else {
        // Placeholder node — renders the loading skeleton row.
        nodes.push({
          id: `__loading_${i}`,
          data: {} as T,
          rowIndex: i,
          level: 0,
          pinned: null,
          isGroup: false,
          expanded: false,
        });
      }
    }
    return nodes;
  }

  private nodeFor(row: T, index: number): RowNode<T> {
    const id = this.idOf(row, index);
    const cached = this.nodeCache.get(id);
    if (cached && cached.data === row) return cached;
    const node = this.makeNode(row, id);
    this.nodeCache.set(id, node);
    return node;
  }

  private makeNode(row: T, id: RowId): RowNode<T> {
    return { id, data: row, rowIndex: -1, level: 0, pinned: null, isGroup: false, expanded: false };
  }

  idOf(row: T, fallbackIndex = -1): RowId {
    if (this.getRowIdFn) return this.getRowIdFn(row);
    const idx = this.rawRows().indexOf(row);
    return idx !== -1 ? idx : fallbackIndex;
  }

  /** Convenience for placeholder detection in templates. */
  isLoadingNode(node: RowNode<T>): boolean {
    return typeof node.id === 'string' && node.id.startsWith('__loading_');
  }
}
