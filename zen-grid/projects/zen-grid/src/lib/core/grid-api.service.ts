/**
 * GridApi<T> — the public, typed facade over all internal stores.
 *
 * Owns nothing: every method delegates to the engine/manager that owns the
 * state. Obtain it via `(gridReady)` or a `viewChild` signal on the component:
 *
 * ```ts
 * grid = viewChild.required(ZenGridComponent<Trade>);
 * api = computed(() => this.grid().api);
 * ```
 */
import { Injectable, Signal, inject } from '@angular/core';
import {
  ColumnDef,
  ColumnFilterModel,
  ColumnPinned,
  FilterModel,
  SortModelEntry,
  colIdOf,
} from '../types/column-def.types';
import {
  CellPosition,
  RowId,
  RowNode,
  RowPinned,
  RowTransaction,
  RowTransactionResult,
} from '../types/row-node.types';
import { DataSourceService } from './data-source.service';
import { SortFilterEngine } from './sort-filter.engine';
import { SelectionManager } from './selection.manager';
import { ColumnStateManager, ColumnState } from './column-state.manager';
import { VirtualScrollEngine } from './virtual-scroll.engine';
import { CsvExportOptions, ExportService } from '../export/export.service';

/** Hooks the component registers so the API can drive UI-level behavior. */
export interface GridUiHooks {
  scrollToTop(top: number): void;
  startEditing(cell: CellPosition, initialKey: string | null): void;
  stopEditing(cancel: boolean): void;
  setFocusedCell(cell: CellPosition | null): void;
  refreshCells(): void;
  flashCells(cells: readonly CellPosition[]): void;
  announce(message: string): void;
}

@Injectable()
export class GridApiService<T extends object = object> {
  private readonly dataSource = inject(DataSourceService<T>);
  private readonly sortFilter = inject(SortFilterEngine<T>);
  private readonly selection = inject(SelectionManager<T>);
  private readonly columns = inject(ColumnStateManager<T>);
  private readonly viewport = inject(VirtualScrollEngine);
  private readonly exporter = inject(ExportService<T>);

  private ui: GridUiHooks | null = null;

  /** @internal Wired by ZenGridComponent at init. */
  registerUiHooks(hooks: GridUiHooks): void {
    this.ui = hooks;
  }

  // ════════════════════════════════════════════════════════════════
  // Data
  // ════════════════════════════════════════════════════════════════

  /** Replace the entire dataset (client row model). */
  setRowData(rows: readonly T[]): void {
    this.dataSource.setRowData(rows);
  }

  /** Add/update/remove rows; pushes the inverse onto the undo stack. */
  applyTransaction(tx: RowTransaction<T>): RowTransactionResult<T> {
    return this.dataSource.applyTransaction(tx);
  }

  /** Patch one row in place (partial update without full re-render). */
  patchRow(rowId: RowId, patch: (row: T) => T): void {
    this.dataSource.patchCell(rowId, patch);
  }

  undo(): void {
    this.dataSource.undo();
  }

  redo(): void {
    this.dataSource.redo();
  }

  readonly canUndo: Signal<boolean> = inject(DataSourceService<T>).canUndo;
  readonly canRedo: Signal<boolean> = inject(DataSourceService<T>).canRedo;

  /** Processed (filtered + sorted + flattened) rows currently rendered. */
  getDisplayedRows(): readonly RowNode<T>[] {
    return this.dataSource.processedRows();
  }

  /** Signal form of the processed rows for reactive consumers. */
  readonly displayedRows: Signal<readonly RowNode<T>[]> = inject(DataSourceService<T>).processedRows;

  getDisplayedRowCount(): number {
    return this.dataSource.totalRowCount();
  }

  /** Drop server-side block cache and refetch (server/infinite models). */
  refreshServerSide(): void {
    this.dataSource.refreshServerSide();
  }

  pinRow(row: T, pinned: RowPinned): void {
    this.dataSource.pinRow(row, pinned);
  }

  toggleGroup(node: RowNode<T>): void {
    this.dataSource.toggleGroup(node);
  }

  toggleDetail(node: RowNode<T>): void {
    this.dataSource.toggleDetail(node);
  }

  // ════════════════════════════════════════════════════════════════
  // Sort & filter
  // ════════════════════════════════════════════════════════════════

  getSortModel(): readonly SortModelEntry[] {
    return this.sortFilter.sortModel();
  }

  setSortModel(model: readonly SortModelEntry[]): void {
    this.sortFilter.sortModel.set(model);
    this.onModelChanged();
  }

  getFilterModel(): Readonly<FilterModel> {
    return this.sortFilter.filterModel();
  }

  setFilterModel(model: Readonly<FilterModel>): void {
    this.sortFilter.filterModel.set(model);
    this.onModelChanged();
  }

  setColumnFilter(colId: string, model: ColumnFilterModel | null): void {
    this.sortFilter.setColumnFilter(colId, model);
    this.onModelChanged();
  }

  /** Global search across all columns with quickFilter !== false. */
  setQuickFilter(text: string | null): void {
    this.sortFilter.quickFilter.set(text);
    this.onModelChanged();
  }

  private onModelChanged(): void {
    if (this.dataSource.rowModelType !== 'client') {
      this.dataSource.refreshServerSide();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Selection
  // ════════════════════════════════════════════════════════════════

  getSelectedRows(): readonly T[] {
    return this.selection.selectedRows();
  }

  readonly selectedRows: Signal<readonly T[]> = inject(SelectionManager<T>).selectedRows;

  selectAll(): void {
    this.selection.selectAll();
  }

  deselectAll(): void {
    this.selection.clear();
  }

  toggleRowSelection(id: RowId): void {
    this.selection.toggle(id);
  }

  // ════════════════════════════════════════════════════════════════
  // Columns
  // ════════════════════════════════════════════════════════════════

  getColumnState(): ColumnState[] {
    return this.columns.getColumnState();
  }

  /** Restore a state previously captured with getColumnState (JSON-safe). */
  applyColumnState(state: readonly ColumnState[]): void {
    this.columns.applyColumnState(state);
  }

  resetColumnState(): void {
    this.columns.resetColumnState();
  }

  setColumnVisible(colId: string, visible: boolean): void {
    this.columns.setVisible(colId, visible);
  }

  setColumnWidth(colId: string, width: number): void {
    this.columns.setWidth(colId, width);
  }

  setColumnPinned(colId: string, pinned: ColumnPinned): void {
    this.columns.setPinned(colId, pinned);
  }

  moveColumn(colId: string, toIndex: number): void {
    this.columns.move(colId, toIndex);
  }

  getVisibleColumns(): readonly ColumnDef<T>[] {
    return this.columns.visibleLeafColumns();
  }

  // ════════════════════════════════════════════════════════════════
  // Viewport / navigation
  // ════════════════════════════════════════════════════════════════

  /** Scroll so the given processed row index is visible. */
  ensureIndexVisible(rowIndex: number, align: 'start' | 'end' | 'nearest' = 'nearest'): void {
    const top = this.viewport.scrollTopForIndex(rowIndex, align);
    if (top !== null) this.ui?.scrollToTop(top);
  }

  ensureRowVisible(id: RowId): void {
    const node = this.dataSource.processedRows().find((n) => n.id === id);
    if (node) this.ensureIndexVisible(node.rowIndex);
  }

  setFocusedCell(cell: CellPosition | null): void {
    this.ui?.setFocusedCell(cell);
  }

  // ════════════════════════════════════════════════════════════════
  // Editing & rendering
  // ════════════════════════════════════════════════════════════════

  startEditingCell(cell: CellPosition): void {
    this.ensureIndexVisible(cell.rowIndex);
    this.ui?.startEditing(cell, null);
  }

  stopEditing(cancel = false): void {
    this.ui?.stopEditing(cancel);
  }

  /** Force re-evaluation of all visible cell bindings. */
  refreshCells(): void {
    this.ui?.refreshCells();
  }

  /** Animate a highlight on specific cells. */
  flashCells(cells: readonly CellPosition[]): void {
    this.ui?.flashCells(cells);
  }

  /** Screen-reader announcement (aria-live polite region). */
  announce(message: string): void {
    this.ui?.announce(message);
  }

  // ════════════════════════════════════════════════════════════════
  // Export
  // ════════════════════════════════════════════════════════════════

  /** Streamed CSV honoring current filters, sort and visible columns. */
  exportCsv(options?: CsvExportOptions): string {
    return this.exporter.toCsv(
      this.dataSource.processedRows(),
      this.columns.visibleLeafColumns(),
      options,
    );
  }

  downloadCsv(fileName: string, options?: CsvExportOptions): void {
    this.exporter.downloadCsv(
      fileName,
      this.dataSource.processedRows(),
      this.columns.visibleLeafColumns(),
      options,
    );
  }

  async exportExcel(fileName: string): Promise<void> {
    await this.exporter.toExcel(
      fileName,
      this.dataSource.processedRows(),
      this.columns.visibleLeafColumns(),
    );
  }

  async exportPdf(fileName: string): Promise<void> {
    await this.exporter.toPdf(
      fileName,
      this.dataSource.processedRows(),
      this.columns.visibleLeafColumns(),
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DevTools
  // ════════════════════════════════════════════════════════════════

  /** Snapshot of all grid state for DevTools/state-inspection hooks. */
  inspectState(): Record<string, unknown> {
    return {
      rowCount: this.dataSource.totalRowCount(),
      processedRowCount: this.dataSource.processedRows().length,
      sortModel: this.sortFilter.sortModel(),
      filterModel: this.sortFilter.filterModel(),
      quickFilter: this.sortFilter.quickFilter(),
      selection: [...this.selection.selectedIds()],
      columnState: this.columns.getColumnState(),
      viewport: {
        scrollTop: this.viewport.scrollTop(),
        rowRange: this.viewport.rowRange(),
        colRange: this.viewport.colRange(),
      },
    };
  }
}

/** Public alias — user code types against `GridApi<T>`, not the service class. */
export type GridApi<T extends object = object> = GridApiService<T>;
