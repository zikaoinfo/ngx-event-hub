/**
 * Column type presets — typed shortcuts for common column shapes.
 * Each returns a plain ColumnDef<T>, so presets compose with overrides:
 *
 * ```ts
 * currencyColumn<Trade>('price', { currency: 'EUR', pinned: 'right' })
 * ```
 */
import { ColumnDef, FieldPath } from '../types/column-def.types';

type Overrides<T extends object> = Partial<ColumnDef<T>>;

/** Locale-formatted date column with the built-in date filter. */
export function dateColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> & { locale?: string; format?: Intl.DateTimeFormatOptions } = {},
): ColumnDef<T> {
  const { locale, format, ...rest } = overrides;
  const fmt = new Intl.DateTimeFormat(locale, format ?? { dateStyle: 'medium' });
  return {
    field,
    filter: 'date',
    sortable: true,
    width: 140,
    valueFormatter: (value) => {
      const d = value instanceof Date ? value : value != null ? new Date(String(value)) : null;
      return d && !Number.isNaN(d.getTime()) ? fmt.format(d) : '';
    },
    ...rest,
  };
}

/** Currency column: right-aligned, Intl-formatted, number filter. */
export function currencyColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> & { currency?: string; locale?: string } = {},
): ColumnDef<T> {
  const { currency = 'USD', locale, ...rest } = overrides;
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
  return {
    field,
    filter: 'number',
    sortable: true,
    width: 130,
    cellClass: 'zen-cell-numeric',
    cellStyle: { 'justify-content': 'flex-end' },
    valueFormatter: (value) => (typeof value === 'number' ? fmt.format(value) : ''),
    aggFunc: 'sum',
    ...rest,
  };
}

/** Numeric column with configurable precision. */
export function numberColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> & { decimals?: number } = {},
): ColumnDef<T> {
  const { decimals = 0, ...rest } = overrides;
  return {
    field,
    filter: 'number',
    sortable: true,
    width: 110,
    cellStyle: { 'justify-content': 'flex-end' },
    valueFormatter: (value) => (typeof value === 'number' ? value.toFixed(decimals) : ''),
    ...rest,
  };
}

/** Percentage column (0.42 → "42.0%"). */
export function percentColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> = {},
): ColumnDef<T> {
  return {
    field,
    filter: 'number',
    sortable: true,
    width: 100,
    cellStyle: { 'justify-content': 'flex-end' },
    valueFormatter: (value) => (typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : ''),
    ...overrides,
  };
}

/** Boolean column rendered as ✓ / ✕ with the boolean filter. */
export function booleanColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> = {},
): ColumnDef<T> {
  return {
    field,
    filter: 'boolean',
    sortable: true,
    width: 90,
    cellStyle: { 'justify-content': 'center' },
    valueFormatter: (value) => (value === true ? '✓' : value === false ? '✕' : ''),
    ...overrides,
  };
}

/**
 * Badge column: maps values to CSS classes (`zen-badge zen-badge-<key>`).
 * Style the classes in app CSS; the set filter comes built in.
 */
export function badgeColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> & { classMap?: Readonly<Record<string, string>> } = {},
): ColumnDef<T> {
  const { classMap = {}, ...rest } = overrides;
  return {
    field,
    filter: 'set',
    sortable: true,
    width: 120,
    cellClass: ({ value }) => {
      const key = String(value ?? '');
      return ['zen-badge', classMap[key] ?? `zen-badge-${key.toLowerCase().replace(/\s+/g, '-')}`];
    },
    ...rest,
  };
}

/** Plain text column with the text filter — the simplest preset. */
export function textColumn<T extends object>(
  field: FieldPath<T>,
  overrides: Overrides<T> = {},
): ColumnDef<T> {
  return { field, filter: 'text', sortable: true, ...overrides };
}
