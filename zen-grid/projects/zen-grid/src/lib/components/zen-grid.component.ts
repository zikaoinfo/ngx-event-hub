/**
 * ZenGridComponent<T> — the grid entry point.
 *
 * Standalone, OnPush, zoneless-compatible: all view state is signals; the
 * scroll handler writes two signals and everything downstream is computed.
 * Provides one DI scope per grid instance for all engines and the GridApi.
 */
import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Signal,
  Type,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  isSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isObservable } from 'rxjs';
import {
  CellEditorParams,
  ColDefOrGroup,
  ColumnDef,
  ColumnFilterModel,
  FilterComponentParams,
  FilterOperator,
  ZenCellEditor,
  ZenFilterComponent,
  colIdOf,
  setByPath,
} from '../types/column-def.types';
import {
  CellClickedEvent,
  CellValueChangedEvent,
  ContextMenuItem,
  FilterChangedEvent,
  GridOptions,
  GridReadyEvent,
  RowClickedEvent,
  RowDataInput,
  SelectionChangedEvent,
  SortChangedEvent,
} from '../types/grid-options.types';
import { CellPosition, RowNode } from '../types/row-node.types';
import { VirtualScrollEngine } from '../core/virtual-scroll.engine';
import { DataSourceService } from '../core/data-source.service';
import { SortFilterEngine } from '../core/sort-filter.engine';
import { SelectionManager } from '../core/selection.manager';
import { ColumnStateManager } from '../core/column-state.manager';
import { GridApiService } from '../core/grid-api.service';
import { CanvasRendererEngine } from '../core/canvas-renderer.engine';
import { ExportService } from '../export/export.service';
import { ThemeService, ZenTheme, DarkModeSetting } from '../theming/theme.service';
import { CellRendererDirective } from '../rendering/cell-renderer.directive';

// ─────────────────────────────────────────────────────────────────────────────
// Internal host directives for dynamic editors / custom filters
// ─────────────────────────────────────────────────────────────────────────────

@Directive({ selector: '[zenEditorHost]', standalone: true })
export class CellEditorHostDirective<T extends object = object> implements OnInit, OnDestroy {
  private readonly vcr = inject(ViewContainerRef);
  readonly editorType = input.required<Type<ZenCellEditor<T>>>({ alias: 'zenEditorHost' });
  readonly params = input.required<CellEditorParams<T>>({ alias: 'zenEditorHostParams' });
  private ref: ComponentRef<ZenCellEditor<T>> | null = null;

  ngOnInit(): void {
    this.ref = this.vcr.createComponent(this.editorType());
    this.ref.instance.zenEditorInit(this.params());
    this.ref.instance.focusIn?.();
    this.ref.changeDetectorRef.markForCheck();
  }

  getValue(): unknown {
    return this.ref?.instance.getValue();
  }

  ngOnDestroy(): void {
    this.ref?.destroy();
  }
}

@Directive({ selector: '[zenFilterHost]', standalone: true })
export class FilterHostDirective<T extends object = object> implements OnInit, OnDestroy {
  private readonly vcr = inject(ViewContainerRef);
  readonly filterType = input.required<Type<ZenFilterComponent<T>>>({ alias: 'zenFilterHost' });
  readonly params = input.required<FilterComponentParams<T, unknown>>({ alias: 'zenFilterHostParams' });
  private ref: ComponentRef<ZenFilterComponent<T>> | null = null;

  ngOnInit(): void {
    this.ref = this.vcr.createComponent(this.filterType());
    this.ref.instance.zenFilterInit(this.params());
    this.ref.changeDetectorRef.markForCheck();
  }

  ngOnDestroy(): void {
    this.ref?.destroy();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// View models
// ─────────────────────────────────────────────────────────────────────────────

interface RowSlot<T extends object> {
  /** Recycling key: same key ⇒ same DOM element across scroll frames. */
  poolKey: number;
  node: RowNode<T>;
  rowIndex: number;
  top: number;
  height: number;
}

interface CellSlot<T extends object> {
  def: ColumnDef<T>;
  colId: string;
  width: number;
  left: number;
  /** Index among all visible leaf columns (for aria-colindex / ranges). */
  colIndex: number;
}

interface FilterPopupState {
  colId: string;
  x: number;
  y: number;
}

const CHECKBOX_COL_WIDTH = 40;

@Component({
  selector: 'zen-grid',
  standalone: true,
  imports: [NgTemplateOutlet, CellRendererDirective, CellEditorHostDirective, FilterHostDirective],
  templateUrl: './zen-grid.component.html',
  styleUrl: './zen-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    VirtualScrollEngine,
    SortFilterEngine,
    DataSourceService,
    SelectionManager,
    ColumnStateManager,
    CanvasRendererEngine,
    ExportService,
    GridApiService,
    ThemeService,
  ],
  host: {
    '[class]': 'themes.hostClasses()',
    '[attr.role]': '"grid"',
    '[attr.aria-label]': 'options().ariaLabel ?? "Data grid"',
    '[attr.aria-rowcount]': 'dataSource.totalRowCount()',
    '[attr.aria-colcount]': 'columns.visibleLeafColumns().length',
    '[attr.aria-multiselectable]': 'selection.mode === "multiple"',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ZenGridComponent<T extends object = object> {
  // ── DI ─────────────────────────────────────────────────────────
  protected readonly viewport = inject(VirtualScrollEngine);
  protected readonly dataSource = inject(DataSourceService<T>);
  protected readonly sortFilter = inject(SortFilterEngine<T>);
  protected readonly selection = inject(SelectionManager<T>);
  protected readonly columns = inject(ColumnStateManager<T>);
  protected readonly canvas = inject(CanvasRendererEngine<T>);
  protected readonly themes = inject(ThemeService);
  readonly api = inject(GridApiService<T>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Inputs ─────────────────────────────────────────────────────
  readonly rowData = input<RowDataInput<T> | null>(null);
  readonly columnDefs = input.required<readonly ColDefOrGroup<T>[]>();
  readonly options = input<GridOptions<T>>({});
  readonly themeName = input<ZenTheme | null>(null, { alias: 'theme' });
  readonly darkMode = input<DarkModeSetting | null>(null);

  // ── Outputs ────────────────────────────────────────────────────
  readonly gridReady = output<GridReadyEvent<T>>();
  readonly rowClicked = output<RowClickedEvent<T>>();
  readonly rowDoubleClicked = output<RowClickedEvent<T>>();
  readonly cellClicked = output<CellClickedEvent<T>>();
  readonly cellValueChanged = output<CellValueChangedEvent<T>>();
  readonly selectionChanged = output<SelectionChangedEvent<T>>();
  readonly sortChanged = output<SortChangedEvent>();
  readonly filterChanged = output<FilterChangedEvent>();

  // ── View refs ──────────────────────────────────────────────────
  private readonly viewportEl = viewChild<ElementRef<HTMLElement>>('viewportEl');
  private readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private readonly editorHost = viewChild(CellEditorHostDirective<T>);
  private readonly defaultEditorInput = viewChild<ElementRef<HTMLInputElement>>('defaultEditor');

  // ── UI state ───────────────────────────────────────────────────
  readonly focusedCell = signal<CellPosition | null>(null);
  readonly editingCell = signal<CellPosition | null>(null);
  protected readonly editorInvalid = signal<string | null>(null);
  protected readonly hoveredRowIndex = signal(-1);
  protected readonly flashSet = signal<ReadonlySet<string>>(new Set());
  protected readonly announcement = signal('');
  protected readonly filterPopup = signal<FilterPopupState | null>(null);
  protected readonly contextMenu = signal<{ x: number; y: number; items: readonly ContextMenuItem<T>[] } | null>(null);
  /** Filter popup draft condition state (built-in filters). */
  protected readonly draftOperator = signal<FilterOperator>('contains');
  protected readonly draftValue = signal('');
  protected readonly draftValueTo = signal('');
  private dragRowIndex: number | null = null;
  private dragColId: string | null = null;
  private resizing: { colId: string; startX: number; startWidth: number } | null = null;

  // ── Derived view models ────────────────────────────────────────

  protected readonly renderMode = computed(() => this.options().renderMode ?? 'dom');
  protected readonly headerHeight = computed(() => this.options().headerHeight ?? 40);
  protected readonly checkboxColumn = computed(() => this.options().selection?.checkboxes === true);

  protected readonly slots: Signal<readonly RowSlot<T>[]> = computed(() => {
    const rows = this.dataSource.processedRows();
    const { start, end } = this.viewport.rowRange();
    const pool = this.viewport.poolSize();
    const out: RowSlot<T>[] = [];
    for (let i = start; i < end && i < rows.length; i++) {
      out.push({
        poolKey: ((i % pool) + pool) % pool,
        node: rows[i],
        rowIndex: i,
        top: this.viewport.offsetOf(i),
        height: this.viewport.heightOf(i),
      });
    }
    return out;
  });

  /** Center cells, column-virtualized. */
  protected readonly centerSlice: Signal<readonly CellSlot<T>[]> = computed(() => {
    const cols = this.columns.centerColumns();
    const widths = this.columns.centerWidths();
    const { start, end } = this.viewport.colRange();
    const baseIndex = this.columns.leftPinned().length;
    const out: CellSlot<T>[] = [];
    let left = 0;
    for (let i = 0; i < cols.length; i++) {
      if (i >= start && i < end) {
        out.push({ def: cols[i], colId: colIdOf(cols[i]), width: widths[i], left, colIndex: baseIndex + i });
      }
      left += widths[i];
    }
    return out;
  });

  protected readonly leftCells: Signal<readonly CellSlot<T>[]> = computed(() =>
    this.sliceFor(this.columns.leftPinned(), 0),
  );
  protected readonly rightCells: Signal<readonly CellSlot<T>[]> = computed(() =>
    this.sliceFor(
      this.columns.rightPinned(),
      this.columns.leftPinned().length + this.columns.centerColumns().length,
    ),
  );

  private sliceFor(cols: readonly ColumnDef<T>[], baseIndex: number): CellSlot<T>[] {
    let left = 0;
    return cols.map((def, i) => {
      const width = this.columns.widthOf(colIdOf(def));
      const slot: CellSlot<T> = { def, colId: colIdOf(def), width, left, colIndex: baseIndex + i };
      left += width;
      return slot;
    });
  }

  /** Group header rows (all but the leaf row) with pixel widths. */
  protected readonly headerGroupRows = computed(() => {
    const rows = this.columns.headerRows();
    if (rows.length <= 1) return [];
    const widths = this.columns.visibleLeafColumns().map((c) => this.columns.widthOf(colIdOf(c)));
    const sum = (start: number, span: number): number =>
      widths.slice(start, start + span).reduce((a, b) => a + b, 0);
    return rows.slice(0, -1).map((row) =>
      row
        .filter((cell) => cell.isGroup)
        .map((cell) => ({ ...cell, width: sum(cell.leafStart, cell.colSpan) })),
    );
  });

  protected readonly sortIndicators = computed(() => {
    const map = new Map<string, { direction: 'asc' | 'desc'; priority: number; multi: boolean }>();
    const model = this.sortFilter.sortModel();
    for (const s of model) {
      map.set(s.colId, { direction: s.direction, priority: s.priority + 1, multi: model.length > 1 });
    }
    return map;
  });

  protected readonly pinnedTopNodes = computed(() =>
    this.dataSource.pinnedTopRows().map((row, i) => this.pinnedNode(row, i, 'top')),
  );
  protected readonly pinnedBottomNodes = computed(() =>
    this.dataSource.pinnedBottomRows().map((row, i) => this.pinnedNode(row, i, 'bottom')),
  );

  private pinnedNode(row: T, index: number, pinned: 'top' | 'bottom'): RowNode<T> {
    return {
      id: this.dataSource.idOf(row),
      data: row,
      rowIndex: -1 - index,
      level: 0,
      pinned,
      isGroup: false,
      expanded: false,
    };
  }

  protected readonly setFilterValues = computed(() => {
    const popup = this.filterPopup();
    if (!popup) return [];
    const def = this.columns.defOf(popup.colId);
    if (!def || def.filter !== 'set') return [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const row of this.dataSource.rawRows()) {
      const v = this.sortFilter.valueOf(row, def);
      const key = String(v);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(v);
      }
    }
    return out.sort((a, b) => String(a).localeCompare(String(b)));
  });

  /** Synthetic column defs that route detail / full-width renderers through
   *  the standard CellRendererDirective. */
  protected readonly detailColDef = computed<ColumnDef<T> | null>(() => {
    const renderer = this.options().detailRenderer;
    return renderer ? { colId: '__detail', cellRenderer: renderer } : null;
  });
  protected readonly fullWidthColDef = computed<ColumnDef<T> | null>(() => {
    const renderer = this.options().fullWidthRenderer;
    return renderer ? { colId: '__fullwidth', cellRenderer: renderer } : null;
  });
  protected readonly detailHeight = computed(() => this.options().detailRowHeight ?? 200);

  protected isFullWidthRow(node: RowNode<T>): boolean {
    if (node.isGroup) return false;
    return this.options().isFullWidthRow?.(node.data) ?? false;
  }

  protected readonly rowHeightDefault = computed(() => {
    const strategy = this.options().rowHeight;
    if (!strategy) return 36;
    return strategy.mode === 'fixed' ? strategy.height : strategy.mode === 'auto' ? strategy.estimate : 36;
  });

  constructor() {
    // Configuration: options → engines. Mutations are untracked so internal
    // reads inside the managers (e.g. prior column state) don't re-trigger
    // this effect.
    effect(() => {
      const opts = this.options();
      untracked(() => {
        this.dataSource.configure({
          rowModelType: opts.rowModelType,
          datasource: opts.datasource,
          getRowId: opts.getRowId,
          immutableData: opts.immutableData,
          cacheBlockSize: opts.cacheBlockSize,
          maxBlocksInCache: opts.maxBlocksInCache,
          grouping: opts.grouping,
          treeData: opts.treeData,
        });
        this.selection.configure(opts.selection ?? { mode: 'none' });
        this.columns.configurePersistence(opts.statePersistence ?? null);
        this.viewport.overscan.set(opts.overscan ?? 4);
        this.applyRowHeightStrategy(opts);
      });
      if (opts.debug && isPlatformBrowser(this.platformId)) {
        // SSR-GUARD: DevTools inspection hook.
        (window as unknown as Record<string, unknown>)['__ZEN_GRID__'] = {
          inspect: () => this.api.inspectState(),
        };
      }
    });

    // Theme inputs.
    effect(() => {
      const t = this.themeName();
      if (t) this.themes.setTheme(t);
      const d = this.darkMode();
      if (d) this.themes.setDarkMode(d);
    });

    // Column defs → state manager + data pipeline. setColumnDefs reads the
    // prior columnStates internally, so it must run untracked.
    effect(() => {
      const defs = this.columnDefs();
      const defaults = this.options().defaultColDef;
      untracked(() => {
        this.columns.setColumnDefs(defs, defaults);
        this.dataSource.columns.set(this.columns.allLeafDefs());
      });
    });

    // rowData input (array / Signal / Observable).
    effect(() => {
      const data = this.rowData();
      if (data === null || data === undefined) return;
      if (isSignal(data)) {
        // Reading inside the effect tracks the external signal.
        const rows = data();
        untracked(() => this.dataSource.setRowData(rows));
      } else if (isObservable(data)) {
        untracked(() => this.dataSource.setRowData(data));
      } else {
        untracked(() => this.dataSource.setRowData(data));
      }
    });

    // Row counts + column widths → virtualization engine.
    effect(() => this.viewport.rowCount.set(this.dataSource.processedRows().length));
    effect(() => this.viewport.columnWidths.set(this.columns.centerWidths()));

    // Server/infinite model: fetch blocks for the visible window.
    effect(() => {
      const { start, end } = this.viewport.rowRange();
      untracked(() => this.dataSource.ensureRange(start, end));
    });

    // Detail row expansion changes row heights → re-measure offsets.
    effect(() => {
      this.dataSource.detailExpandedIds();
      untracked(() => this.viewport.invalidateFrom(0));
    });

    // Cell flashing on real data changes.
    effect(() => {
      const changed = this.dataSource.lastChangedCells();
      if (changed.size === 0) return;
      this.flashSet.set(changed);
      setTimeout(() => this.flashSet.set(new Set()), 900);
    });

    // Canvas paint path.
    effect(() => {
      if (this.renderMode() !== 'canvas') return;
      const rows = this.dataSource.processedRows();
      const cols = this.columns.centerColumns();
      this.viewport.scrollTop();
      this.viewport.scrollLeft();
      const selected = new Set<number>();
      const ids = this.selection.selectedIds();
      for (const n of rows) if (ids.has(n.id)) selected.add(n.rowIndex);
      this.canvas.schedulePaint(rows, cols, selected);
    });

    // Browser-only wiring.
    afterNextRender(() => {
      // SSR-GUARD: everything below touches the real DOM.
      const vp = this.viewportEl()?.nativeElement;
      if (vp) {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            this.viewport.viewportHeight.set(entry.contentRect.height);
            this.viewport.viewportWidth.set(entry.contentRect.width);
            this.columns.applyFlex(entry.contentRect.width);
          }
        });
        ro.observe(vp);
        this.destroyRef.onDestroy(() => ro.disconnect());
        this.viewport.viewportHeight.set(vp.clientHeight);
        this.viewport.viewportWidth.set(vp.clientWidth);
        this.columns.applyFlex(vp.clientWidth);
      }
      const canvasEl = this.canvasEl()?.nativeElement;
      if (canvasEl) this.canvas.attach(canvasEl);

      this.api.registerUiHooks({
        scrollToTop: (top) => {
          const el = this.viewportEl()?.nativeElement;
          if (el) el.scrollTop = top;
        },
        startEditing: (cell, initialKey) => this.startEditing(cell, initialKey),
        stopEditing: (cancel) => this.stopEditing(cancel),
        setFocusedCell: (cell) => {
          this.focusedCell.set(cell);
          if (cell) this.focusCellElement(cell);
        },
        refreshCells: () => this.dataSource.rawRows.set([...this.dataSource.rawRows()]),
        flashCells: (cells) => {
          const set = new Set(this.flashSet());
          const rows = this.dataSource.processedRows();
          for (const c of cells) {
            const node = rows[c.rowIndex];
            if (node) set.add(`${String(node.id)}|${c.colId}`);
          }
          this.flashSet.set(set);
          setTimeout(() => this.flashSet.set(new Set()), 900);
        },
        announce: (message) => this.announce(message),
      });
      this.gridReady.emit({ api: this.api });
    });
  }

  private applyRowHeightStrategy(opts: GridOptions<T>): void {
    const strategy = opts.rowHeight ?? { mode: 'fixed' as const, height: 36 };
    const detailHeight = opts.detailRowHeight ?? 200;
    const hasDetail = !!opts.detailRenderer;

    if (strategy.mode === 'fixed' && !hasDetail) {
      this.viewport.setFixedRowHeight(strategy.height);
      return;
    }
    const baseOf = (node: RowNode<T>): number => {
      switch (strategy.mode) {
        case 'fixed': return strategy.height;
        case 'dynamic': return strategy.getHeight(node);
        case 'auto': return strategy.estimate;
      }
    };
    this.viewport.setDynamicRowHeight((index) => {
      const node = this.dataSource.processedRows()[index];
      if (!node) return this.rowHeightDefault();
      return baseOf(node) + (node.detailExpanded && hasDetail ? detailHeight : 0);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // Scroll / pointer
  // ════════════════════════════════════════════════════════════════

  protected onScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.viewport.scrollTop.set(el.scrollTop);
    this.viewport.scrollLeft.set(el.scrollLeft);
  }

  protected onRowClick(node: RowNode<T>, event: MouseEvent): void {
    if (node.isGroup) {
      this.dataSource.toggleGroup(node);
      return;
    }
    const changed = this.selection.handleRowClick(node, event);
    if (changed) this.emitSelection();
    this.rowClicked.emit({ row: node.data, node, rowIndex: node.rowIndex, event });
  }

  protected onRowDblClick(node: RowNode<T>, event: MouseEvent): void {
    this.rowDoubleClicked.emit({ row: node.data, node, rowIndex: node.rowIndex, event });
  }

  protected onCellClick(node: RowNode<T>, slot: CellSlot<T>, event: MouseEvent): void {
    const cell: CellPosition = { rowIndex: node.rowIndex, colId: slot.colId };
    this.focusedCell.set(cell);
    if (event.shiftKey && this.options().selection?.cellRanges) {
      this.selection.extendCellRange(node.rowIndex, slot.colIndex);
    } else {
      this.selection.startCellRange(node.rowIndex, slot.colIndex, event.ctrlKey || event.metaKey);
    }
    this.cellClicked.emit({
      row: node.data,
      value: this.sortFilter.valueOf(node.data, slot.def),
      colId: slot.colId,
      rowIndex: node.rowIndex,
      event,
    });
    if (this.editTriggerEnabled('click') && this.isEditable(node, slot.def)) {
      this.startEditing(cell, null);
    }
  }

  protected onCellDblClick(node: RowNode<T>, slot: CellSlot<T>): void {
    if (this.editTriggerEnabled('doubleClick') && this.isEditable(node, slot.def)) {
      this.startEditing({ rowIndex: node.rowIndex, colId: slot.colId }, null);
    }
  }

  protected onContextMenu(node: RowNode<T>, slot: CellSlot<T>, event: MouseEvent): void {
    const factory = this.options().contextMenuItems;
    if (!factory) return;
    event.preventDefault();
    const cell: CellPosition = { rowIndex: node.rowIndex, colId: slot.colId };
    this.contextMenu.set({
      x: event.clientX,
      y: event.clientY,
      items: factory({ row: node.data, cell, api: this.api }),
    });
  }

  protected runMenuItem(item: ContextMenuItem<T>): void {
    const menu = this.contextMenu();
    if (!menu) return;
    this.contextMenu.set(null);
    const focused = this.focusedCell();
    const node = focused ? this.dataSource.processedRows()[focused.rowIndex] : undefined;
    if (node && focused) item.action({ row: node.data, cell: focused, api: this.api });
  }

  protected onCanvasClick(event: MouseEvent): void {
    const hit = this.canvas.cellAt(event.offsetX, event.offsetY, this.columns.centerColumns());
    if (!hit) return;
    this.focusedCell.set(hit);
    const node = this.dataSource.processedRows()[hit.rowIndex];
    if (node) this.onRowClick(node, event);
  }

  // ── Row drag reorder ───────────────────────────────────────────

  protected onRowDragStart(node: RowNode<T>): void {
    if (this.options().rowDragEnabled) this.dragRowIndex = node.rowIndex;
  }

  protected onRowDrop(target: RowNode<T>, event: DragEvent): void {
    event.preventDefault();
    if (this.dragRowIndex === null || !this.options().rowDragEnabled) return;
    const rows = this.dataSource.processedRows();
    const source = rows[this.dragRowIndex];
    if (!source || source.isGroup || target.isGroup) return;
    this.dataSource.applyTransaction({ remove: [source.data] });
    const targetPos = this.dataSource.rawRows().indexOf(target.data);
    this.dataSource.applyTransaction({
      add: [source.data],
      addIndex: targetPos === -1 ? undefined : targetPos,
    });
    this.dragRowIndex = null;
  }

  protected allowDrop(event: DragEvent): void {
    if (this.options().rowDragEnabled || this.dragColId !== null) event.preventDefault();
  }

  // ── Column resize / reorder / header interactions ──────────────

  protected onResizeStart(colId: string, event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = { colId, startX: event.clientX, startWidth: this.columns.widthOf(colId) };
    const move = (e: PointerEvent): void => {
      if (!this.resizing) return;
      this.columns.setWidth(this.resizing.colId, this.resizing.startWidth + (e.clientX - this.resizing.startX));
    };
    const up = (): void => {
      this.resizing = null;
      // SSR-GUARD: listeners only ever attached in the browser (pointer event origin).
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  protected onHeaderDragStart(colId: string): void {
    this.dragColId = colId;
  }

  protected onHeaderDrop(targetColId: string, event: DragEvent): void {
    event.preventDefault();
    if (!this.dragColId || this.dragColId === targetColId) return;
    const states = this.columns.columnStates();
    const to = states.findIndex((s) => s.colId === targetColId);
    if (to !== -1) this.columns.move(this.dragColId, to);
    this.dragColId = null;
  }

  protected onHeaderClick(def: ColumnDef<T>, event: MouseEvent): void {
    if (def.sortable === false) return;
    const model = this.sortFilter.toggleSort(colIdOf(def), event.shiftKey);
    if (this.options().rowModelType && this.options().rowModelType !== 'client') {
      this.dataSource.refreshServerSide();
    }
    this.sortChanged.emit({ sortModel: model });
    const entry = model.find((s) => s.colId === colIdOf(def));
    this.announce(
      entry
        ? `Sorted by ${this.columns.headerNameOf(colIdOf(def))} ${entry.direction === 'asc' ? 'ascending' : 'descending'}`
        : `Sorting removed from ${this.columns.headerNameOf(colIdOf(def))}`,
    );
  }

  // ── Filter popup ───────────────────────────────────────────────

  protected openFilter(colId: string, event: MouseEvent): void {
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const hostRect = this.host.nativeElement.getBoundingClientRect();
    const existing = this.sortFilter.filterModel()[colId];
    this.draftOperator.set((existing?.conditions[0]?.operator as FilterOperator) ?? this.defaultOperatorFor(colId));
    this.draftValue.set(String(existing?.conditions[0]?.value ?? ''));
    this.draftValueTo.set(String(existing?.conditions[0]?.valueTo ?? ''));
    this.filterPopup.set({ colId, x: rect.left - hostRect.left, y: rect.bottom - hostRect.top });
  }

  protected defaultOperatorFor(colId: string): FilterOperator {
    const type = this.columns.defOf(colId)?.filter;
    return type === 'number' || type === 'date' ? 'equals' : 'contains';
  }

  protected filterOperatorsFor(colId: string): readonly FilterOperator[] {
    switch (this.columns.defOf(colId)?.filter) {
      case 'number':
        return ['equals', 'notEquals', 'lessThan', 'greaterThan', 'inRange', 'blank', 'notBlank'];
      case 'date':
        return ['equals', 'before', 'after', 'inRange', 'blank', 'notBlank'];
      default:
        return ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'blank', 'notBlank'];
    }
  }

  protected applyFilterDraft(): void {
    const popup = this.filterPopup();
    if (!popup) return;
    const def = this.columns.defOf(popup.colId);
    const type = def?.filter === false || def?.filter === undefined ? 'text' : def.filter;
    const raw = this.draftValue();
    const value: unknown = type === 'number' ? Number(raw) : raw;
    const valueTo: unknown = type === 'number' ? Number(this.draftValueTo()) : this.draftValueTo();
    const model: ColumnFilterModel =
      raw === '' && !['blank', 'notBlank'].includes(this.draftOperator())
        ? { filterType: type as ColumnFilterModel['filterType'], join: 'and', conditions: [] }
        : {
            filterType: type as ColumnFilterModel['filterType'],
            join: 'and',
            conditions: [{ operator: this.draftOperator(), value, valueTo }],
          };
    this.commitFilter(popup.colId, model.conditions.length > 0 ? model : null);
  }

  protected toggleSetFilterValue(value: unknown): void {
    const popup = this.filterPopup();
    if (!popup) return;
    const existing = this.sortFilter.filterModel()[popup.colId];
    const current = new Set(existing?.setValues ?? this.setFilterValues());
    if (current.has(value)) current.delete(value);
    else current.add(value);
    const all = this.setFilterValues();
    this.commitFilter(
      popup.colId,
      current.size === all.length
        ? null
        : { filterType: 'set', join: 'and', conditions: [], setValues: [...current] },
      false,
    );
  }

  protected isSetValueActive(value: unknown): boolean {
    const popup = this.filterPopup();
    if (!popup) return false;
    const existing = this.sortFilter.filterModel()[popup.colId];
    return existing?.setValues ? existing.setValues.includes(value) : true;
  }

  protected clearFilter(): void {
    const popup = this.filterPopup();
    if (popup) this.commitFilter(popup.colId, null);
  }

  private commitFilter(colId: string, model: ColumnFilterModel | null, close = true): void {
    this.sortFilter.setColumnFilter(colId, model);
    if (this.options().rowModelType && this.options().rowModelType !== 'client') {
      this.dataSource.refreshServerSide();
    }
    this.filterChanged.emit({
      filterModel: this.sortFilter.filterModel(),
      quickFilter: this.sortFilter.quickFilter(),
    });
    this.announce(
      model
        ? `Filter applied to ${this.columns.headerNameOf(colId)}`
        : `Filter removed from ${this.columns.headerNameOf(colId)}`,
    );
    if (close) this.filterPopup.set(null);
  }

  protected customFilterParams(colId: string): FilterComponentParams<T, unknown> {
    const def = this.columns.defOf(colId);
    if (!def) throw new Error(`[ZenGrid] Unknown column '${colId}'.`);
    return {
      colDef: def,
      api: this.api,
      onModelChange: (model) => this.commitFilter(colId, model),
    };
  }

  protected isFilterActive(colId: string): boolean {
    return colId in this.sortFilter.filterModel();
  }

  // ════════════════════════════════════════════════════════════════
  // Editing
  // ════════════════════════════════════════════════════════════════

  protected isEditable(node: RowNode<T>, def: ColumnDef<T>): boolean {
    if (node.isGroup || this.dataSource.isLoadingNode(node)) return false;
    if (typeof def.editable === 'function') return def.editable(node.data);
    return def.editable === true;
  }

  protected isEditing(rowIndex: number, colId: string): boolean {
    const cell = this.editingCell();
    return cell !== null && cell.rowIndex === rowIndex && cell.colId === colId;
  }

  startEditing(cell: CellPosition, initialKey: string | null): void {
    const node = this.dataSource.processedRows()[cell.rowIndex];
    const def = this.columns.defOf(cell.colId);
    if (!node || !def || !this.isEditable(node, def)) return;
    this.editorInvalid.set(null);
    this.editingCell.set(cell);
    this.focusedCell.set(cell);
    // Focus the default editor input once rendered.
    queueMicrotask(() => {
      const input = this.defaultEditorInput()?.nativeElement;
      if (input) {
        input.focus();
        if (initialKey && initialKey.length === 1) input.value = initialKey;
        else input.select();
      }
    });
  }

  stopEditing(cancel: boolean): void {
    const cell = this.editingCell();
    if (!cell) return;
    if (cancel) {
      this.editingCell.set(null);
      this.editorInvalid.set(null);
      this.focusCellElement(cell);
      return;
    }
    const node = this.dataSource.processedRows()[cell.rowIndex];
    const def = this.columns.defOf(cell.colId);
    if (!node || !def) {
      this.editingCell.set(null);
      return;
    }
    const oldValue = this.sortFilter.valueOf(node.data, def);
    const newValue = this.readEditorValue(def, oldValue);

    for (const validator of def.validators ?? []) {
      const result = validator(newValue, node.data);
      if (!result.valid) {
        this.editorInvalid.set(result.message ?? 'Invalid value');
        return; // stay in edit mode, show the error
      }
    }

    this.editingCell.set(null);
    this.editorInvalid.set(null);
    if (newValue !== oldValue) {
      const updated = this.writeValue(node.data, def, newValue);
      this.dataSource.applyTransaction({ update: [updated] });
      this.cellValueChanged.emit({
        row: updated,
        colId: cell.colId,
        oldValue,
        newValue,
        rowIndex: cell.rowIndex,
      });
    }
    this.focusCellElement(cell);
  }

  private readEditorValue(def: ColumnDef<T>, oldValue: unknown): unknown {
    const customHost = this.editorHost();
    if (def.cellEditor && customHost) return customHost.getValue();
    const input = this.defaultEditorInput()?.nativeElement;
    if (!input) return oldValue;
    if (typeof oldValue === 'number') {
      const n = Number(input.value);
      return Number.isNaN(n) ? oldValue : n;
    }
    if (typeof oldValue === 'boolean') return input.value === 'true';
    return input.value;
  }

  private writeValue(row: T, def: ColumnDef<T>, value: unknown): T {
    if (def.valueSetter) return def.valueSetter(row, value);
    if (def.field) {
      return setByPath(row, def.field as string, value);
    }
    throw new Error(
      `[ZenGrid] Column '${colIdOf(def)}' is editable but has neither 'field' nor 'valueSetter'.`,
    );
  }

  protected editorParams(node: RowNode<T>, def: ColumnDef<T>): CellEditorParams<T> {
    return {
      value: this.sortFilter.valueOf(node.data, def),
      valueFormatted: this.sortFilter.displayValue(node.data, def),
      row: node.data,
      rowIndex: node.rowIndex,
      colDef: def,
      api: this.api,
      initialKey: null,
      stopEditing: (cancel = false) => this.stopEditing(cancel),
    };
  }

  protected editorInitialValue(node: RowNode<T>, def: ColumnDef<T>): string {
    const v = this.sortFilter.valueOf(node.data, def);
    return v === null || v === undefined ? '' : String(v);
  }

  // ════════════════════════════════════════════════════════════════
  // Keyboard navigation (WCAG 2.1 grid pattern)
  // ════════════════════════════════════════════════════════════════

  protected onKeydown(event: KeyboardEvent): void {
    if (this.editingCell()) {
      if (event.key === 'Enter') {
        this.stopEditing(false);
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.stopEditing(true);
        event.preventDefault();
      }
      return;
    }

    const focused = this.focusedCell();
    const cols = this.columns.visibleLeafColumns();
    const rowCount = this.dataSource.processedRows().length;
    if (cols.length === 0 || rowCount === 0) return;

    const colIndex = focused ? cols.findIndex((c) => colIdOf(c) === focused.colId) : 0;
    const rowIndex = focused?.rowIndex ?? 0;
    const pageSize = Math.max(1, Math.floor(this.viewport.viewportHeight() / this.rowHeightDefault()) - 1);

    const moveTo = (r: number, c: number): void => {
      const next: CellPosition = {
        rowIndex: Math.max(0, Math.min(rowCount - 1, r)),
        colId: colIdOf(cols[Math.max(0, Math.min(cols.length - 1, c))]),
      };
      this.focusedCell.set(next);
      this.api.ensureIndexVisible(next.rowIndex);
      this.focusCellElement(next);
      event.preventDefault();
    };

    switch (event.key) {
      case 'ArrowDown': moveTo(rowIndex + 1, colIndex); break;
      case 'ArrowUp': moveTo(rowIndex - 1, colIndex); break;
      case 'ArrowRight': moveTo(rowIndex, colIndex + 1); break;
      case 'ArrowLeft': moveTo(rowIndex, colIndex - 1); break;
      case 'PageDown': moveTo(rowIndex + pageSize, colIndex); break;
      case 'PageUp': moveTo(rowIndex - pageSize, colIndex); break;
      case 'Home': moveTo(event.ctrlKey ? 0 : rowIndex, 0); break;
      case 'End': moveTo(event.ctrlKey ? rowCount - 1 : rowIndex, cols.length - 1); break;
      case 'Tab': {
        if (!focused) break;
        const nextCol = colIndex + (event.shiftKey ? -1 : 1);
        if (nextCol >= 0 && nextCol < cols.length) moveTo(rowIndex, nextCol);
        break;
      }
      case 'Enter':
      case 'F2': {
        if (!focused) break;
        if (event.key === 'Enter' || this.editTriggerEnabled('f2')) {
          this.startEditing(focused, null);
          event.preventDefault();
        }
        break;
      }
      case ' ': {
        if (!focused) break;
        const node = this.dataSource.processedRows()[focused.rowIndex];
        if (node && !node.isGroup && this.selection.mode !== 'none') {
          this.selection.toggle(node.id);
          this.emitSelection();
          event.preventDefault();
        }
        break;
      }
      case 'Escape':
        this.filterPopup.set(null);
        this.contextMenu.set(null);
        break;
      case 'c':
      case 'C':
        if ((event.ctrlKey || event.metaKey) && this.options().clipboard !== false) {
          this.copySelectionToClipboard();
          event.preventDefault();
        }
        break;
      case 'a':
      case 'A':
        if ((event.ctrlKey || event.metaKey) && this.selection.mode === 'multiple') {
          this.selection.selectAll();
          this.emitSelection();
          event.preventDefault();
        }
        break;
      default: {
        // Printable character on an editable cell starts editing with that key.
        if (focused && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const node = this.dataSource.processedRows()[focused.rowIndex];
          const def = this.columns.defOf(focused.colId);
          if (node && def && this.isEditable(node, def)) {
            this.startEditing(focused, event.key);
            event.preventDefault();
          }
        }
      }
    }
  }

  protected isFocused(rowIndex: number, colId: string): boolean {
    const f = this.focusedCell();
    return f !== null && f.rowIndex === rowIndex && f.colId === colId;
  }

  private focusCellElement(cell: CellPosition): void {
    // SSR-GUARD: only meaningful with a real DOM; afterNextRender ensures
    // this code path is reached client-side only via user interaction.
    if (!isPlatformBrowser(this.platformId)) return;
    queueMicrotask(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>(
        `[data-row-index="${cell.rowIndex}"][data-col-id="${CSS.escape(cell.colId)}"]`,
      );
      el?.focus();
    });
  }

  // ════════════════════════════════════════════════════════════════
  // Clipboard
  // ════════════════════════════════════════════════════════════════

  private copySelectionToClipboard(): void {
    // SSR-GUARD: navigator.clipboard is browser-only.
    if (!isPlatformBrowser(this.platformId)) return;
    const cols = this.columns.visibleLeafColumns();
    const rows = this.dataSource.processedRows();
    let text = '';

    const ranges = this.selection.cellRanges();
    if (ranges.length > 0) {
      const lines: string[] = [];
      for (const range of ranges) {
        const [rLo, rHi] = sortPair(range.startRowIndex, range.endRowIndex);
        const [cLo, cHi] = sortPair(range.startColIndex, range.endColIndex);
        for (let r = rLo; r <= rHi; r++) {
          const node = rows[r];
          if (!node || node.isGroup) continue;
          const cells: string[] = [];
          for (let c = cLo; c <= cHi; c++) {
            cells.push(this.sortFilter.displayValue(node.data, cols[c]));
          }
          lines.push(cells.join('\t'));
        }
      }
      text = lines.join('\n');
    } else {
      const ids = this.selection.selectedIds();
      const selected = rows.filter((n) => !n.isGroup && ids.has(n.id));
      const source = selected.length > 0 ? selected : rows.filter((n) => this.isFocusedRow(n));
      text = source
        .map((n) => cols.map((c) => this.sortFilter.displayValue(n.data, c)).join('\t'))
        .join('\n');
    }
    if (text) {
      void navigator.clipboard?.writeText(text);
      this.announce('Copied to clipboard');
    }
  }

  private isFocusedRow(node: RowNode<T>): boolean {
    return this.focusedCell()?.rowIndex === node.rowIndex;
  }

  // ════════════════════════════════════════════════════════════════
  // Selection / a11y helpers
  // ════════════════════════════════════════════════════════════════

  protected toggleRowCheckbox(node: RowNode<T>, event: Event): void {
    event.stopPropagation();
    this.selection.toggle(node.id);
    this.emitSelection();
  }

  protected toggleHeaderCheckbox(): void {
    this.selection.toggleAll();
    this.emitSelection();
  }

  private emitSelection(): void {
    this.selectionChanged.emit({
      selectedRows: this.selection.selectedRows(),
      selectedIds: this.selection.selectedIds(),
    });
  }

  protected announce(message: string): void {
    this.announcement.set(message);
  }

  protected isFlashing(node: RowNode<T>, colId: string): boolean {
    return this.flashSet().has(`${String(node.id)}|${colId}`);
  }

  protected cellClassFor(node: RowNode<T>, slot: CellSlot<T>): string {
    const def = slot.def;
    if (!def.cellClass) return '';
    if (typeof def.cellClass === 'string') return def.cellClass;
    if (Array.isArray(def.cellClass)) return def.cellClass.join(' ');
    const result = (def.cellClass as Exclude<typeof def.cellClass, string | readonly string[]>)({
      value: this.sortFilter.valueOf(node.data, def),
      row: node.data,
      rowIndex: node.rowIndex,
      colDef: def,
    });
    return result === null ? '' : Array.isArray(result) ? result.join(' ') : String(result);
  }

  protected cellStyleFor(node: RowNode<T>, slot: CellSlot<T>): Readonly<Record<string, string>> | null {
    const def = slot.def;
    if (!def.cellStyle) return null;
    if (typeof def.cellStyle === 'function') {
      return def.cellStyle({
        value: this.sortFilter.valueOf(node.data, def),
        row: node.data,
        rowIndex: node.rowIndex,
        colDef: def,
      });
    }
    return def.cellStyle;
  }

  protected rowClassFor(node: RowNode<T>): string {
    const classes: string[] = [];
    const rules = this.options().rowClassRules;
    if (rules && !node.isGroup) {
      for (const [cls, rule] of Object.entries(rules)) {
        if (rule(node.data)) classes.push(cls);
      }
    }
    const getRowClass = this.options().getRowClass;
    if (getRowClass) {
      const extra = getRowClass(node);
      if (typeof extra === 'string') classes.push(extra);
      else if (extra) classes.push(...extra);
    }
    return classes.join(' ');
  }

  protected rowStyleFor(node: RowNode<T>): Readonly<Record<string, string>> | null {
    return this.options().getRowStyle?.(node) ?? null;
  }

  protected tooltipFor(node: RowNode<T>, slot: CellSlot<T>): string | null {
    const tooltip = slot.def.tooltip;
    if (typeof tooltip === 'string') return tooltip;
    if (typeof tooltip === 'function' && !isComponentType(tooltip)) {
      return (tooltip as (value: unknown, row: T) => string)(
        this.sortFilter.valueOf(node.data, slot.def),
        node.data,
      );
    }
    return null;
  }

  protected groupLabel(node: RowNode<T>): string {
    return `${this.columns.headerNameOf(node.groupColId ?? '')}: ${String(node.groupKey ?? '')} (${node.leafCount ?? 0})`;
  }

  protected aggSummary(node: RowNode<T>): string {
    const agg = node.aggData;
    if (!agg) return '';
    return Object.entries(agg)
      .map(([colId, value]) => `${this.columns.headerNameOf(colId)}: ${formatAgg(value)}`)
      .join('  ·  ');
  }

  protected toggleTreeOrGroup(node: RowNode<T>, event: Event): void {
    event.stopPropagation();
    if (this.options().treeData) void this.dataSource.toggleTreeRow(node);
    else this.dataSource.toggleGroup(node);
  }

  protected toggleDetail(node: RowNode<T>, event: Event): void {
    event.stopPropagation();
    this.dataSource.toggleDetail(node);
    this.viewport.invalidateFrom(node.rowIndex);
  }

  private editTriggerEnabled(trigger: 'click' | 'doubleClick' | 'f2'): boolean {
    const triggers = this.options().editTriggers ?? ['doubleClick', 'f2'];
    return triggers.includes(trigger);
  }

  protected readonly Math = Math;
}

function sortPair(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

function isComponentType(value: unknown): boolean {
  return typeof value === 'function' && 'ɵcmp' in (value as object);
}

function formatAgg(value: unknown): string {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value ?? '');
}
