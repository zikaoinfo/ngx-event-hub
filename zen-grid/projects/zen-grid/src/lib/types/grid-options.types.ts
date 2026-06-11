/**
 * Grid-level configuration interfaces, datasource contracts and event payloads.
 */
import type { Observable } from 'rxjs';
import type { Signal, Type } from '@angular/core';
import type {
  ColDefOrGroup,
  ColumnDef,
  ColumnFilterModel,
  FilterModel,
  SortModelEntry,
  ZenCellRenderer,
} from './column-def.types';
import type { CellPosition, GetRowIdFn, RowId, RowNode } from './row-node.types';
import type { GridApi } from '../core/grid-api.service';

// ─────────────────────────────────────────────────────────────────────────────
// Row models & datasource
// ─────────────────────────────────────────────────────────────────────────────

export type RowModelType = 'client' | 'server' | 'infinite';

/** Params emitted to the datasource — server-side sort/filter passthrough. */
export interface GetRowsParams {
  /** Inclusive start row index of the requested block. */
  startRow: number;
  /** Exclusive end row index of the requested block. */
  endRow: number;
  sortModel: readonly SortModelEntry[];
  filterModel: Readonly<FilterModel>;
  quickFilter: string | null;
  /** Expanded group path for server-side grouping / lazy tree children. */
  groupKeys: readonly string[];
}

export interface GetRowsResult<T extends object> {
  rows: readonly T[];
  /**
   * Total row count when known. Omit for infinite scroll until the final
   * block (a short block implies the end).
   */
  totalRowCount?: number;
}

/** App-implemented lazy datasource for 'server' and 'infinite' row models. */
export interface ZenDatasource<T extends object> {
  getRows(params: GetRowsParams): Promise<GetRowsResult<T>> | Observable<GetRowsResult<T>>;
}

/** Accepted shapes for the rowData input. */
export type RowDataInput<T extends object> = readonly T[] | Signal<readonly T[]> | Observable<readonly T[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Row height
// ─────────────────────────────────────────────────────────────────────────────

export type RowHeightStrategy<T extends object = object> =
  | { mode: 'fixed'; height: number }
  | { mode: 'dynamic'; getHeight: (row: RowNode<T>) => number }
  /** Content-measured heights; `estimate` seeds the scrollbar before measure. */
  | { mode: 'auto'; estimate: number };

// ─────────────────────────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────────────────────────

export type RowSelectionMode = 'none' | 'single' | 'multiple';

export interface SelectionOptions {
  mode: RowSelectionMode;
  /** Render a leading checkbox column. */
  checkboxes?: boolean;
  /** Shift+click range selection (multiple mode). */
  rangeSelect?: boolean;
  /** Allow drag-selecting rectangular cell ranges. */
  cellRanges?: boolean;
  /** Clicking a row toggles selection (vs. ctrl/cmd-click). */
  clickToggles?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping / pivot
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupingOptions {
  /** Show subtotal aggregates on group rows. */
  subtotals?: boolean;
  /** Append a pinned grand-total row. */
  grandTotalRow?: 'top' | 'bottom' | null;
  defaultExpanded?: boolean | number; // true=all, number=levels
}

export interface TreeDataOptions<T extends object> {
  /** Returns children, or undefined when they must be lazy-loaded. */
  getChildren: (row: T) => readonly T[] | undefined;
  /** Lazy loader invoked on first expand when getChildren returns undefined. */
  loadChildren?: (row: T) => Promise<readonly T[]>;
  hasChildren?: (row: T) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Editing
// ─────────────────────────────────────────────────────────────────────────────

export type EditTrigger = 'click' | 'doubleClick' | 'f2' | 'programmatic';

// ─────────────────────────────────────────────────────────────────────────────
// State persistence
// ─────────────────────────────────────────────────────────────────────────────

export interface StatePersistenceOptions {
  /** 'localStorage' | 'queryParams' (router-aware) | custom handlers. */
  strategy: 'localStorage' | 'queryParams' | 'custom';
  key: string;
  save?: (key: string, json: string) => void;
  load?: (key: string) => string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextMenuItem<T extends object = object> {
  label: string;
  icon?: string;
  disabled?: boolean;
  action: (params: { row: T; cell: CellPosition; api: GridApi<T> }) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// GridOptions
// ─────────────────────────────────────────────────────────────────────────────

export interface GridOptions<T extends object = object> {
  // ── Data ──────────────────────────────────────────────────────
  rowModelType?: RowModelType;
  datasource?: ZenDatasource<T>;
  /** Stable row identity. Strongly recommended; falls back to index. */
  getRowId?: GetRowIdFn<T>;
  /** Diff new arrays by id; keep untouched RowNode identity. */
  immutableData?: boolean;
  /** Block size for server/infinite models. Default 100. */
  cacheBlockSize?: number;
  /** Max blocks kept in the LRU page cache. Default 10. */
  maxBlocksInCache?: number;

  // ── Rendering ─────────────────────────────────────────────────
  rowHeight?: RowHeightStrategy<T>;
  headerHeight?: number;
  /** Extra rows rendered above/below the viewport. Default 4. */
  overscan?: number;
  /** Switch the body to the canvas paint path (100k+ rows). */
  renderMode?: 'dom' | 'canvas';
  /** Renderer for rows flagged full-width. */
  fullWidthRenderer?: Type<ZenCellRenderer<T>>;
  isFullWidthRow?: (row: T) => boolean;

  // ── Columns ───────────────────────────────────────────────────
  /** Defaults merged under every column definition. */
  defaultColDef?: Partial<ColumnDef<T>>;
  /** Auto group column override (grouping/tree data). */
  autoGroupColumn?: Partial<ColumnDef<T>>;

  // ── Features ──────────────────────────────────────────────────
  selection?: SelectionOptions;
  grouping?: GroupingOptions;
  treeData?: TreeDataOptions<T>;
  editTriggers?: readonly EditTrigger[];
  /** Master-detail renderer (component receives the master row). */
  detailRenderer?: Type<ZenCellRenderer<T>>;
  detailRowHeight?: number;
  rowDragEnabled?: boolean;
  contextMenuItems?: (params: { row: T; cell: CellPosition; api: GridApi<T> }) => readonly ContextMenuItem<T>[];
  /** Enable clipboard copy (Ctrl/Cmd+C) of selection/ranges. Default true. */
  clipboard?: boolean;

  // ── Styling ───────────────────────────────────────────────────
  rowClassRules?: Readonly<Record<string, (row: T) => boolean>>;
  getRowClass?: (row: RowNode<T>) => string | readonly string[] | null;
  getRowStyle?: (row: RowNode<T>) => Readonly<Record<string, string>> | null;

  // ── Persistence ───────────────────────────────────────────────
  statePersistence?: StatePersistenceOptions;

  // ── A11y / debug ──────────────────────────────────────────────
  /** aria-label for the grid region. */
  ariaLabel?: string;
  /** Verbose dev-mode diagnostics + window.__ZEN_GRID__ inspection hook. */
  debug?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface GridReadyEvent<T extends object = object> {
  api: GridApi<T>;
}

export interface RowClickedEvent<T extends object = object> {
  row: T;
  node: RowNode<T>;
  rowIndex: number;
  event: MouseEvent;
}

export interface CellClickedEvent<T extends object = object, V = unknown> {
  row: T;
  value: V;
  colId: string;
  rowIndex: number;
  event: MouseEvent;
}

export interface CellValueChangedEvent<T extends object = object, V = unknown> {
  row: T;
  colId: string;
  oldValue: V;
  newValue: V;
  rowIndex: number;
}

export interface SelectionChangedEvent<T extends object = object> {
  selectedRows: readonly T[];
  selectedIds: ReadonlySet<RowId>;
}

export interface SortChangedEvent {
  sortModel: readonly SortModelEntry[];
}

export interface FilterChangedEvent {
  filterModel: Readonly<FilterModel>;
  quickFilter: string | null;
}

export interface ColumnEvent {
  colId: string;
  type: 'resize' | 'move' | 'pin' | 'visibility';
}

export type { ColumnFilterModel };
