/**
 * Row model types: RowNode wrapper, transactions, tree/group nodes.
 */

export type RowId = string | number;

export type GetRowIdFn<T extends object> = (row: T) => RowId;

export type RowPinned = 'top' | 'bottom' | null;

/**
 * Internal wrapper around a user row. Reference-stable in immutable mode so
 * OnPush bindings can skip untouched rows.
 */
export interface RowNode<T extends object = object> {
  readonly id: RowId;
  readonly data: T;
  /** Index in the processed (filtered/sorted/flattened) list. */
  rowIndex: number;
  /** Tree/group depth, 0 for root rows. */
  level: number;
  pinned: RowPinned;

  // ── Group / tree nodes ────────────────────────────────────────
  readonly isGroup: boolean;
  /** colId the group was created from (group rows only). */
  groupColId?: string;
  /** The grouping key value (group rows only). */
  groupKey?: unknown;
  /** Aggregated values per colId (group + grand-total rows). */
  aggData?: Readonly<Record<string, unknown>>;
  /** Direct children (group/tree rows only). */
  children?: RowNode<T>[];
  /** Leaf descendant count (group rows only). */
  leafCount?: number;
  expanded: boolean;
  /** Tree data: children load lazily when first expanded. */
  hasLazyChildren?: boolean;
  /** Master-detail: this node renders an expanded detail row below it. */
  detailExpanded?: boolean;
  /** Full-width row marker — rendered by fullWidthRenderer spanning all columns. */
  isFullWidth?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────────────────────────────────────

export interface RowTransaction<T extends object = object> {
  add?: readonly T[];
  /** Insertion index for `add` (default: append). */
  addIndex?: number;
  /** Rows matched by id and replaced. */
  update?: readonly T[];
  /** Rows matched by id and removed. */
  remove?: readonly T[];
}

export interface RowTransactionResult<T extends object = object> {
  added: readonly T[];
  updated: readonly T[];
  removed: readonly T[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell coordinates / ranges
// ─────────────────────────────────────────────────────────────────────────────

export interface CellPosition {
  rowIndex: number;
  colId: string;
}

export interface CellRange {
  startRowIndex: number;
  endRowIndex: number;
  /** Inclusive column bounds, in visible-column order. */
  startColIndex: number;
  endColIndex: number;
}
