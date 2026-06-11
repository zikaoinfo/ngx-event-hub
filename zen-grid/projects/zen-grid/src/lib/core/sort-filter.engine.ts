/**
 * Sorting & filtering engine.
 *
 * Owns the sortModel / filterModel / quickFilter signals and exposes pure
 * `sort()` / `filter()` operations consumed by DataSourceService's computed
 * pipeline. All logic is allocation-light and stable-sort based.
 */
import { Injectable, signal } from '@angular/core';
import {
  ColumnDef,
  ColumnFilterModel,
  Comparator,
  FilterCondition,
  FilterModel,
  SortDirection,
  SortModelEntry,
  colIdOf,
  getByPath,
} from '../types/column-def.types';

@Injectable()
export class SortFilterEngine<T extends object = object> {
  readonly sortModel = signal<readonly SortModelEntry[]>([]);
  readonly filterModel = signal<Readonly<FilterModel>>({});
  readonly quickFilter = signal<string | null>(null);

  // ── Model mutation ─────────────────────────────────────────────

  /**
   * Cycle a column through asc → desc → none. With `append` (shift-click),
   * the column is added to the existing multi-sort instead of replacing it.
   */
  toggleSort(colId: string, append: boolean): readonly SortModelEntry[] {
    const model = [...this.sortModel()];
    const idx = model.findIndex((s) => s.colId === colId);
    const next: SortDirection | null =
      idx === -1 ? 'asc' : model[idx].direction === 'asc' ? 'desc' : null;

    let result: SortModelEntry[];
    if (!append) {
      result = next === null ? [] : [{ colId, direction: next, priority: 0 }];
    } else {
      if (idx !== -1) model.splice(idx, 1);
      if (next !== null) model.push({ colId, direction: next, priority: model.length });
      result = model.map((s, i) => ({ ...s, priority: i }));
    }
    this.sortModel.set(result);
    return result;
  }

  setColumnFilter(colId: string, model: ColumnFilterModel | null): void {
    const current = { ...this.filterModel() };
    if (model === null) delete current[colId];
    else current[colId] = model;
    this.filterModel.set(current);
  }

  /** True when any column filter or the quick filter is active. */
  isFilterActive(): boolean {
    return Object.keys(this.filterModel()).length > 0 || !!this.quickFilter();
  }

  // ── Sorting ────────────────────────────────────────────────────

  /** Stable multi-column sort. Returns a new array; input is not mutated. */
  sort(rows: readonly T[], sortModel: readonly SortModelEntry[], columns: readonly ColumnDef<T>[]): readonly T[] {
    if (sortModel.length === 0) return rows;
    const ordered = [...sortModel].sort((a, b) => a.priority - b.priority);
    const colById = new Map(columns.map((c) => [colIdOf(c), c]));

    const comparators = ordered
      .map((entry) => {
        const col = colById.get(entry.colId);
        if (!col) return null;
        const cmp: Comparator<unknown> = col.comparator
          ? (col.comparator as Comparator<unknown>)
          : defaultComparator;
        const sign = entry.direction === 'asc' ? 1 : -1;
        return (a: T, b: T) => sign * cmp(this.valueOf(a, col), this.valueOf(b, col));
      })
      .filter((c): c is (a: T, b: T) => number => c !== null);

    return [...rows].sort((a, b) => {
      for (const cmp of comparators) {
        const r = cmp(a, b);
        if (r !== 0) return r;
      }
      return 0;
    });
  }

  // ── Filtering ──────────────────────────────────────────────────

  filter(
    rows: readonly T[],
    filterModel: Readonly<FilterModel>,
    quickFilter: string | null,
    columns: readonly ColumnDef<T>[],
  ): readonly T[] {
    const colById = new Map(columns.map((c) => [colIdOf(c), c]));
    const entries = Object.entries(filterModel);
    const quick = quickFilter?.trim().toLowerCase() || null;
    if (entries.length === 0 && quick === null) return rows;

    const quickColumns = columns.filter((c) => c.quickFilter !== false);

    return rows.filter((row) => {
      for (const [colId, model] of entries) {
        const colDef = colById.get(colId);
        if (!colDef) continue;
        if (!this.passesColumnFilter(this.valueOf(row, colDef), model)) return false;
      }
      if (quick !== null) {
        const hit = quickColumns.some((c) =>
          this.displayValue(row, c).toLowerCase().includes(quick),
        );
        if (!hit) return false;
      }
      return true;
    });
  }

  passesColumnFilter(value: unknown, model: ColumnFilterModel): boolean {
    if (model.filterType === 'set') {
      const set = model.setValues ?? [];
      return set.some((v) => looseEquals(v, value));
    }
    if (model.conditions.length === 0) return true;
    const results = model.conditions.map((c) => evaluateCondition(value, c, model.filterType));
    return model.join === 'or' ? results.some(Boolean) : results.every(Boolean);
  }

  // ── Value access ───────────────────────────────────────────────

  valueOf(row: T, col: ColumnDef<T>): unknown {
    if (col.valueGetter) {
      // The api reference is only needed by user code that closes over it.
      return col.valueGetter(row, undefined as never);
    }
    return col.field ? getByPath(row, col.field as string) : undefined;
  }

  displayValue(row: T, col: ColumnDef<T>): string {
    const v = this.valueOf(row, col);
    if (col.valueFormatter) return col.valueFormatter(v, row);
    return formatDefault(v);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests and the export service)
// ─────────────────────────────────────────────────────────────────────────────

export function defaultComparator(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

export function formatDefault(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString();
  return String(v);
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

export function evaluateCondition(
  value: unknown,
  condition: FilterCondition,
  filterType: ColumnFilterModel['filterType'],
): boolean {
  const op = condition.operator;
  if (op === 'blank') return isBlank(value);
  if (op === 'notBlank') return !isBlank(value);
  if (isBlank(value)) return false;

  switch (filterType) {
    case 'text': {
      const v = String(value).toLowerCase();
      const f = String(condition.value ?? '').toLowerCase();
      switch (op) {
        case 'contains': return v.includes(f);
        case 'notContains': return !v.includes(f);
        case 'equals': return v === f;
        case 'notEquals': return v !== f;
        case 'startsWith': return v.startsWith(f);
        case 'endsWith': return v.endsWith(f);
        default: return true;
      }
    }
    case 'number': {
      const v = Number(value);
      const f = Number(condition.value);
      const to = Number(condition.valueTo);
      switch (op) {
        case 'equals': return v === f;
        case 'notEquals': return v !== f;
        case 'lessThan': return v < f;
        case 'lessThanOrEqual': return v <= f;
        case 'greaterThan': return v > f;
        case 'greaterThanOrEqual': return v >= f;
        case 'inRange': return v >= f && v <= to;
        default: return true;
      }
    }
    case 'date': {
      const v = toTime(value);
      const f = toTime(condition.value);
      const to = toTime(condition.valueTo);
      if (v === null || f === null) return false;
      switch (op) {
        case 'equals': return sameDay(v, f);
        case 'before': return v < f;
        case 'after': return v > f;
        case 'inRange': return to !== null && v >= f && v <= to;
        default: return true;
      }
    }
    case 'boolean':
      return Boolean(value) === Boolean(condition.value);
    default:
      return true;
  }
}

function toTime(v: unknown): number | null {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' || typeof v === 'number') {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
