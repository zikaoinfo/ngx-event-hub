/**
 * Row grouping, aggregation, pivoting and tree-data flattening.
 *
 * Pure functions over RowNode arrays — the DataSourceService composes these
 * inside its computed pipeline.
 */
import {
  AggFunc,
  AggFuncSpec,
  BuiltInAggFunc,
  ColumnDef,
  colIdOf,
  defaultHeaderName,
  getByPath,
} from '../types/column-def.types';
import { RowId, RowNode } from '../types/row-node.types';

// ─────────────────────────────────────────────────────────────────────────────
// Built-in aggregation functions
// ─────────────────────────────────────────────────────────────────────────────

const BUILT_IN_AGGS: Record<BuiltInAggFunc, AggFunc> = {
  sum: (vs) => numeric(vs).reduce((a, b) => a + b, 0),
  avg: (vs) => {
    const ns = numeric(vs);
    return ns.length === 0 ? null : ns.reduce((a, b) => a + b, 0) / ns.length;
  },
  min: (vs) => {
    const ns = numeric(vs);
    return ns.length === 0 ? null : Math.min(...ns);
  },
  max: (vs) => {
    const ns = numeric(vs);
    return ns.length === 0 ? null : Math.max(...ns);
  },
  count: (vs) => vs.length,
  first: (vs) => (vs.length > 0 ? vs[0] : null),
  last: (vs) => (vs.length > 0 ? vs[vs.length - 1] : null),
};

function numeric(values: readonly unknown[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n) && v !== null && v !== undefined && v !== '') out.push(n);
  }
  return out;
}

export function resolveAggFunc(spec: AggFuncSpec): AggFunc {
  return typeof spec === 'function' ? spec : BUILT_IN_AGGS[spec];
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

function columnValue<T extends object>(row: T, col: ColumnDef<T>): unknown {
  if (col.valueGetter) return col.valueGetter(row, undefined as never);
  return col.field ? getByPath(row, col.field as string) : undefined;
}

/** Computes aggData for a set of leaf rows against all aggFunc columns. */
export function aggregate<T extends object>(
  leaves: readonly RowNode<T>[],
  columns: readonly ColumnDef<T>[],
): Record<string, unknown> {
  const agg: Record<string, unknown> = {};
  for (const col of columns) {
    if (!col.aggFunc) continue;
    const values = leaves.map((n) => columnValue(n.data, col));
    agg[colIdOf(col)] = resolveAggFunc(col.aggFunc as AggFuncSpec)(values);
  }
  return agg;
}

/**
 * Groups flat rows by the given group columns (in order), producing a tree of
 * group RowNodes with aggregates, then flattens it honoring `expandedGroups`.
 */
export function groupAndFlatten<T extends object>(
  rows: readonly RowNode<T>[],
  groupColumns: readonly ColumnDef<T>[],
  allColumns: readonly ColumnDef<T>[],
  expandedGroups: ReadonlySet<string>,
  defaultExpanded: boolean | number,
): RowNode<T>[] {
  if (groupColumns.length === 0) return [...rows];

  const build = (
    leaves: readonly RowNode<T>[],
    level: number,
    parentKey: string,
  ): RowNode<T>[] => {
    if (level >= groupColumns.length) {
      return leaves.map((n) => ({ ...n, level }));
    }
    const col = groupColumns[level];
    const colId = colIdOf(col);
    const buckets = new Map<string, RowNode<T>[]>();
    const keyValues = new Map<string, unknown>();
    for (const leaf of leaves) {
      const value = columnValue(leaf.data, col);
      const key = String(value);
      if (!buckets.has(key)) {
        buckets.set(key, []);
        keyValues.set(key, value);
      }
      buckets.get(key)!.push(leaf);
    }

    const out: RowNode<T>[] = [];
    for (const [key, children] of buckets) {
      const groupPath = `${parentKey}/${colId}:${key}`;
      const expanded = expandedGroups.has(groupPath)
        ? true
        : expandedGroups.has(`!${groupPath}`)
          ? false
          : typeof defaultExpanded === 'number'
            ? level < defaultExpanded
            : defaultExpanded;

      const groupNode: RowNode<T> = {
        id: `__group${groupPath}` as RowId,
        data: children[0].data,
        rowIndex: -1,
        level,
        pinned: null,
        isGroup: true,
        groupColId: colId,
        groupKey: keyValues.get(key),
        leafCount: children.length,
        aggData: aggregate(children, allColumns),
        expanded,
      };
      out.push(groupNode);
      if (expanded) out.push(...build(children, level + 1, groupPath));
    }
    return out;
  };

  return build(rows, 0, '');
}

/** Stable path key for a group node — used by the expansion set. */
export function groupPathOf<T extends object>(node: RowNode<T>): string {
  return String(node.id).replace(/^__group/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree data
// ─────────────────────────────────────────────────────────────────────────────

/** Flattens hierarchical rows depth-first, honoring per-node expansion. */
export function flattenTree<T extends object>(
  roots: readonly RowNode<T>[],
  expandedIds: ReadonlySet<RowId>,
  getChildren: (row: T) => readonly T[] | undefined,
  hasChildren: ((row: T) => boolean) | undefined,
  makeNode: (row: T, level: number) => RowNode<T>,
): RowNode<T>[] {
  const out: RowNode<T>[] = [];
  const walk = (nodes: readonly RowNode<T>[], level: number): void => {
    for (const node of nodes) {
      const kids = getChildren(node.data);
      const mayHaveKids = hasChildren ? hasChildren(node.data) : (kids?.length ?? 0) > 0;
      const expanded = expandedIds.has(node.id);
      out.push({
        ...node,
        level,
        expanded,
        isGroup: mayHaveKids,
        hasLazyChildren: mayHaveKids && kids === undefined,
      });
      if (expanded && kids !== undefined) {
        walk(kids.map((k) => makeNode(k, level + 1)), level + 1);
      }
    }
  };
  walk(roots, 0);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pivoting
// ─────────────────────────────────────────────────────────────────────────────

export interface PivotResult<T extends object> {
  /** Generated value columns, one per (pivotValue × aggColumn). */
  columns: ColumnDef<T>[];
  /** One row per distinct group key, with pivoted aggregates merged in. */
  rows: Array<Record<string, unknown>>;
}

/**
 * Pivot mode: rows are grouped by `rowGroup` columns; distinct values of the
 * `pivot` column become generated columns whose cells hold the aggregate of
 * each aggFunc column within that (group × pivotValue) bucket.
 */
export function pivot<T extends object>(
  rows: readonly T[],
  columns: readonly ColumnDef<T>[],
): PivotResult<T> {
  const groupCols = columns
    .filter((c) => c.rowGroup)
    .sort((a, b) => (a.rowGroupIndex ?? 0) - (b.rowGroupIndex ?? 0));
  const pivotCol = columns.find((c) => c.pivot);
  const aggCols = columns.filter((c) => c.aggFunc);
  if (!pivotCol || groupCols.length === 0 || aggCols.length === 0) {
    return { columns: [], rows: [] };
  }

  const pivotValues: unknown[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const v = columnValue(row, pivotCol);
    const key = String(v);
    if (!seen.has(key)) {
      seen.add(key);
      pivotValues.push(v);
    }
  }
  pivotValues.sort((a, b) => String(a).localeCompare(String(b)));

  // Bucket rows by group key tuple.
  const groups = new Map<string, { keys: unknown[]; rows: T[] }>();
  for (const row of rows) {
    const keys = groupCols.map((c) => columnValue(row, c));
    const id = keys.map(String).join(' ');
    if (!groups.has(id)) groups.set(id, { keys, rows: [] });
    groups.get(id)!.rows.push(row);
  }

  const generated: ColumnDef<T>[] = [];
  for (const pv of pivotValues) {
    for (const agg of aggCols) {
      generated.push({
        colId: `pivot_${String(pv)}_${colIdOf(agg)}`,
        headerName: `${String(pv)} ${agg.headerName ?? defaultHeaderName(colIdOf(agg))}`,
        sortable: true,
        valueGetter: ((row: T) =>
          (row as Record<string, unknown>)[`pivot_${String(pv)}_${colIdOf(agg)}`]) as ColumnDef<T>['valueGetter'],
      });
    }
  }

  const outRows: Array<Record<string, unknown>> = [];
  for (const { keys, rows: bucket } of groups.values()) {
    const out: Record<string, unknown> = {};
    groupCols.forEach((c, i) => (out[colIdOf(c)] = keys[i]));
    for (const pv of pivotValues) {
      const slice = bucket.filter((r) => String(columnValue(r, pivotCol)) === String(pv));
      for (const agg of aggCols) {
        const values = slice.map((r) => columnValue(r, agg));
        out[`pivot_${String(pv)}_${colIdOf(agg)}`] =
          slice.length === 0 ? null : resolveAggFunc(agg.aggFunc as AggFuncSpec)(values);
      }
    }
    outRows.push(out);
  }

  return { columns: generated, rows: outRows };
}
