/**
 * ZenGrid column definition typing system.
 *
 * Everything in this file is erased at runtime — pure types plus the
 * `getByPath` / `setByPath` runtime helpers used by the engines.
 */
import type { TemplateRef, Type } from '@angular/core';
import type { GridApi } from '../core/grid-api.service';

// ─────────────────────────────────────────────────────────────────────────────
// Field paths — typed dot-notation access ("address.city") with depth limit
// ─────────────────────────────────────────────────────────────────────────────

type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date;
type Prev = [never, 0, 1, 2, 3, 4];

/** All dot-notation paths into `T`, recursion-limited to depth `D` (default 3). */
export type FieldPath<T, D extends number = 3> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : {
        [K in keyof T & string]: NonNullable<T[K]> extends Primitive
          ? K
          : NonNullable<T[K]> extends readonly unknown[]
            ? K
            : K | `${K}.${FieldPath<NonNullable<T[K]>, Prev[D]>}`;
      }[keyof T & string];

/** The value type found at path `P` in `T`. */
export type FieldPathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? FieldPathValue<NonNullable<T[K]>, Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/** Runtime companion of {@link FieldPath}: reads `obj` at a dotted path. */
export function getByPath<T extends object>(obj: T, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Immutably writes `value` at a dotted path, returning a new object. */
export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const parts = path.split('.');
  const clone = (target: object, depth: number): object => {
    const key = parts[depth];
    const next =
      depth === parts.length - 1
        ? value
        : clone(((target as Record<string, unknown>)[key] as object) ?? {}, depth + 1);
    return { ...target, [key]: next };
  };
  return clone(obj, 0) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sorting
// ─────────────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortModelEntry {
  colId: string;
  direction: SortDirection;
  /** 0-based multi-sort priority; lower sorts first. */
  priority: number;
}

export type Comparator<V> = (a: V, b: V) => number;

// ─────────────────────────────────────────────────────────────────────────────
// Filtering
// ─────────────────────────────────────────────────────────────────────────────

export type FilterType = 'text' | 'number' | 'date' | 'set' | 'boolean' | 'custom';

export type TextFilterOperator =
  | 'contains' | 'notContains' | 'equals' | 'notEquals'
  | 'startsWith' | 'endsWith' | 'blank' | 'notBlank';

export type NumberFilterOperator =
  | 'equals' | 'notEquals' | 'lessThan' | 'lessThanOrEqual'
  | 'greaterThan' | 'greaterThanOrEqual' | 'inRange' | 'blank' | 'notBlank';

export type DateFilterOperator =
  | 'equals' | 'before' | 'after' | 'inRange' | 'blank' | 'notBlank';

export type FilterOperator = TextFilterOperator | NumberFilterOperator | DateFilterOperator;

export interface FilterCondition<V = unknown> {
  operator: FilterOperator;
  value?: V;
  /** Upper bound for `inRange`. */
  valueTo?: V;
}

/** Per-column filter state: N conditions joined with AND/OR, or a set filter. */
export interface ColumnFilterModel<V = unknown> {
  filterType: FilterType;
  join: 'and' | 'or';
  conditions: FilterCondition<V>[];
  /** For `filterType: 'set'` — values that pass. */
  setValues?: readonly unknown[];
}

/** Map of colId → filter model. JSON-serializable for persistence. */
export type FilterModel = Record<string, ColumnFilterModel>;

/** Contract for custom filter components injected into the filter popup. */
export interface ZenFilterComponent<T extends object = object, V = unknown> {
  zenFilterInit(params: FilterComponentParams<T, V>): void;
  /** Return the current model, or null when the filter is inactive. */
  getModel(): ColumnFilterModel<V> | null;
  setModel(model: ColumnFilterModel<V> | null): void;
}

export interface FilterComponentParams<T extends object, V> {
  colDef: ColumnDef<T, V>;
  api: GridApi<T>;
  /** Push the model back into the grid (re-runs the pipeline). */
  onModelChange: (model: ColumnFilterModel<V> | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cell rendering / editing / validation contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface CellRendererParams<T extends object = object, V = unknown> {
  value: V;
  /** Formatted display string (after valueFormatter). */
  valueFormatted: string;
  row: T;
  rowIndex: number;
  colDef: ColumnDef<T, V>;
  api: GridApi<T>;
}

/** Implemented by custom cell renderer components. */
export interface ZenCellRenderer<T extends object = object, V = unknown> {
  zenInit(params: CellRendererParams<T, V>): void;
  /**
   * Called on data refresh. Return true if the component updated itself,
   * false to force destroy + recreate.
   */
  zenRefresh?(params: CellRendererParams<T, V>): boolean;
}

export interface CellEditorParams<T extends object = object, V = unknown>
  extends CellRendererParams<T, V> {
  /** Key that initiated the edit ('Enter', 'F2', a printable char, or null). */
  initialKey: string | null;
  stopEditing: (cancel?: boolean) => void;
}

/** Implemented by custom inline cell editor components. */
export interface ZenCellEditor<T extends object = object, V = unknown> {
  zenEditorInit(params: CellEditorParams<T, V>): void;
  /** Value committed when editing stops (unless cancelled). */
  getValue(): V;
  /** Optional veto — return false to refuse the edit start. */
  isEditable?(): boolean;
  focusIn?(): void;
}

export interface CellValidationResult {
  valid: boolean;
  message?: string;
}

export type CellValidatorFn<T extends object = object, V = unknown> = (
  value: V,
  row: T,
) => CellValidationResult;

export interface CellClassParams<T extends object = object, V = unknown> {
  value: V;
  row: T;
  rowIndex: number;
  colDef: ColumnDef<T, V>;
}

export interface CellTemplateContext<T extends object = object, V = unknown> {
  $implicit: V;
  row: T;
  rowIndex: number;
  colDef: ColumnDef<T, V>;
}

export interface TooltipComponentParams<T extends object = object, V = unknown> {
  value: V;
  row: T;
  colDef: ColumnDef<T, V>;
}

export interface ZenTooltipComponent<T extends object = object, V = unknown> {
  zenTooltipInit(params: TooltipComponentParams<T, V>): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

export type BuiltInAggFunc = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last';
export type AggFunc<V = unknown> = (values: readonly V[]) => unknown;
export type AggFuncSpec<V = unknown> = BuiltInAggFunc | AggFunc<V>;

// ─────────────────────────────────────────────────────────────────────────────
// Column definition
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnPinned = 'left' | 'right' | null;

export interface SpanParams<T extends object = object> {
  row: T;
  rowIndex: number;
  colId: string;
}

export interface ColumnDef<T extends object = object, V = unknown> {
  /** Unique id. Defaults to `field` when omitted. Required if no `field`. */
  colId?: string;
  /** Typed dot-notation accessor into T (autocompleted, depth ≤ 3). */
  field?: FieldPath<T>;
  /** Header label. Defaults to a humanized `field`. */
  headerName?: string;
  /** Tooltip on the header cell. */
  headerTooltip?: string;

  // ── Value pipeline ─────────────────────────────────────────────
  /** Computed value; takes precedence over `field`. */
  valueGetter?: (row: T, api: GridApi<T>) => V;
  /** Writes an edited value back; must return the (possibly new) row. */
  valueSetter?: (row: T, value: V) => T;
  /** Formats the value for display and (by default) export. */
  valueFormatter?: (value: V, row: T) => string;
  /** Overrides `valueFormatter` for exports only. */
  exportFormatter?: (value: V, row: T) => string;

  // ── Sizing ─────────────────────────────────────────────────────
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Flex-grow share of free space (overrides width). */
  flex?: number;
  resizable?: boolean;

  // ── Sort & filter ──────────────────────────────────────────────
  sortable?: boolean;
  comparator?: Comparator<V>;
  /** Built-in filter type, or false to disable filtering. */
  filter?: FilterType | false;
  /** Custom Angular filter component (filterType must be 'custom'). */
  filterComponent?: Type<ZenFilterComponent<T, V>>;
  /** Opaque params passed to the filter component. */
  filterParams?: Readonly<Record<string, unknown>>;
  /** Include this column in the quick (global) filter. Default true. */
  quickFilter?: boolean;

  // ── Layout ─────────────────────────────────────────────────────
  pinned?: ColumnPinned;
  hide?: boolean;
  /** Prevent the user from hiding/showing this column. */
  lockVisible?: boolean;
  /** Prevent drag-reordering of this column. */
  suppressMovable?: boolean;
  colSpan?: (params: SpanParams<T>) => number;
  rowSpan?: (params: SpanParams<T>) => number;

  // ── Rendering ──────────────────────────────────────────────────
  cellRenderer?: Type<ZenCellRenderer<T, V>>;
  cellRendererTemplate?: TemplateRef<CellTemplateContext<T, V>>;
  cellClass?: string | readonly string[] | ((params: CellClassParams<T, V>) => string | readonly string[] | null);
  cellStyle?: Readonly<Record<string, string>> | ((params: CellClassParams<T, V>) => Readonly<Record<string, string>> | null);
  tooltip?: string | ((value: V, row: T) => string) | Type<ZenTooltipComponent<T, V>>;
  /** Animate the cell when its value changes (immutable/transaction updates). */
  enableCellFlash?: boolean;

  // ── Editing ────────────────────────────────────────────────────
  editable?: boolean | ((row: T) => boolean);
  cellEditor?: Type<ZenCellEditor<T, V>>;
  validators?: readonly CellValidatorFn<T, V>[];

  // ── Selection ──────────────────────────────────────────────────
  checkboxSelection?: boolean;
  headerCheckboxSelection?: boolean;

  // ── Grouping / pivot / aggregation ─────────────────────────────
  rowGroup?: boolean;
  rowGroupIndex?: number;
  pivot?: boolean;
  aggFunc?: AggFuncSpec<V>;
}

/** Multi-level header group. */
export interface ColumnGroupDef<T extends object = object> {
  groupId: string;
  headerName: string;
  children: readonly ColDefOrGroup<T>[];
  /** Marker to discriminate from ColumnDef at runtime. */
  readonly isGroup: true;
}

export type ColDefOrGroup<T extends object = object> = ColumnDef<T> | ColumnGroupDef<T>;

export function isColumnGroup<T extends object>(def: ColDefOrGroup<T>): def is ColumnGroupDef<T> {
  return (def as ColumnGroupDef<T>).isGroup === true;
}

/**
 * Identity helper that pins V from the column's accessors so per-column
 * generics survive inside a `ColumnDef<T>[]` array:
 *
 * ```ts
 * col<Trade, number>({ field: 'price', valueFormatter: v => v.toFixed(2) })
 * ```
 */
export function col<T extends object, V>(def: ColumnDef<T, V>): ColumnDef<T> {
  return def as ColumnDef<T>;
}

/** Resolves the effective column id (colId ?? field). Throws in dev if neither set. */
export function colIdOf<T extends object>(def: ColumnDef<T>): string {
  const id = def.colId ?? (def.field as string | undefined);
  if (id === undefined) {
    throw new Error(
      '[ZenGrid] ColumnDef requires `colId` when `field` is not set. ' +
        `Offending column: ${JSON.stringify({ headerName: def.headerName })}`,
    );
  }
  return id;
}

/** Humanizes a field path: "user.firstName" → "First Name". */
export function defaultHeaderName(field: string): string {
  const leaf = field.split('.').pop() ?? field;
  return leaf
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
