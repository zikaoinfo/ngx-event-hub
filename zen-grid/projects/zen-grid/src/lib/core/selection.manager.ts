/**
 * Row selection (single / multiple / checkbox / shift-range) and
 * rectangular cell-range selection.
 */
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { CellRange, RowId, RowNode } from '../types/row-node.types';
import { SelectionOptions } from '../types/grid-options.types';
import { DataSourceService } from './data-source.service';

@Injectable()
export class SelectionManager<T extends object = object> {
  private readonly dataSource = inject(DataSourceService<T>);

  private options: SelectionOptions = { mode: 'none' };
  /** Anchor row index for shift-click range selection. */
  private anchorIndex: number | null = null;

  readonly selectedIds = signal<ReadonlySet<RowId>>(new Set());
  readonly cellRanges = signal<readonly CellRange[]>([]);

  readonly selectedRows: Signal<readonly T[]> = computed(() => {
    const ids = this.selectedIds();
    if (ids.size === 0) return [];
    return this.dataSource
      .processedRows()
      .filter((n) => !n.isGroup && ids.has(n.id))
      .map((n) => n.data);
  });

  /** Header checkbox tri-state. */
  readonly headerCheckboxState: Signal<'all' | 'some' | 'none'> = computed(() => {
    const ids = this.selectedIds();
    const rows = this.dataSource.processedRows().filter((n) => !n.isGroup);
    if (rows.length === 0 || ids.size === 0) return 'none';
    const selected = rows.filter((n) => ids.has(n.id)).length;
    return selected === rows.length ? 'all' : selected > 0 ? 'some' : 'none';
  });

  configure(options: SelectionOptions): void {
    this.options = options;
    if (options.mode === 'none') this.clear();
  }

  get mode(): SelectionOptions['mode'] {
    return this.options.mode;
  }

  isSelected(id: RowId): boolean {
    return this.selectedIds().has(id);
  }

  /**
   * Handle a row click with modifier keys. Returns true if selection changed.
   */
  handleRowClick(node: RowNode<T>, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
    if (this.options.mode === 'none' || node.isGroup) return false;
    const multi = this.options.mode === 'multiple';
    const toggleKey = event.ctrlKey || event.metaKey || this.options.clickToggles === true;

    if (multi && event.shiftKey && this.options.rangeSelect !== false && this.anchorIndex !== null) {
      this.selectIndexRange(this.anchorIndex, node.rowIndex, !toggleKey);
      return true;
    }
    this.anchorIndex = node.rowIndex;

    const next = new Set(toggleKey && multi ? this.selectedIds() : []);
    if (toggleKey && next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    this.selectedIds.set(next);
    return true;
  }

  toggle(id: RowId): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) next.delete(id);
    else {
      if (this.options.mode === 'single') next.clear();
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  /** Select all rows between two processed indices (inclusive). */
  selectIndexRange(from: number, to: number, replace: boolean): void {
    const [lo, hi] = from <= to ? [from, to] : [to, from];
    const next = new Set(replace ? [] : this.selectedIds());
    for (const node of this.dataSource.processedRows()) {
      if (!node.isGroup && node.rowIndex >= lo && node.rowIndex <= hi) next.add(node.id);
    }
    this.selectedIds.set(next);
  }

  selectAll(): void {
    const next = new Set<RowId>();
    for (const node of this.dataSource.processedRows()) {
      if (!node.isGroup) next.add(node.id);
    }
    this.selectedIds.set(next);
  }

  toggleAll(): void {
    if (this.headerCheckboxState() === 'all') this.clear();
    else this.selectAll();
  }

  clear(): void {
    this.selectedIds.set(new Set());
    this.cellRanges.set([]);
    this.anchorIndex = null;
  }

  // ── Cell ranges ────────────────────────────────────────────────

  startCellRange(rowIndex: number, colIndex: number, additive: boolean): void {
    if (this.options.cellRanges !== true) return;
    const range: CellRange = {
      startRowIndex: rowIndex,
      endRowIndex: rowIndex,
      startColIndex: colIndex,
      endColIndex: colIndex,
    };
    this.cellRanges.set(additive ? [...this.cellRanges(), range] : [range]);
  }

  extendCellRange(rowIndex: number, colIndex: number): void {
    const ranges = this.cellRanges();
    if (ranges.length === 0) return;
    const last = ranges[ranges.length - 1];
    this.cellRanges.set([
      ...ranges.slice(0, -1),
      { ...last, endRowIndex: rowIndex, endColIndex: colIndex },
    ]);
  }

  isCellInRange(rowIndex: number, colIndex: number): boolean {
    return this.cellRanges().some((r) => {
      const [rLo, rHi] = order(r.startRowIndex, r.endRowIndex);
      const [cLo, cHi] = order(r.startColIndex, r.endColIndex);
      return rowIndex >= rLo && rowIndex <= rHi && colIndex >= cLo && colIndex <= cHi;
    });
  }
}

function order(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}
