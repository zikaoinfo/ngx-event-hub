import { aggregate, groupAndFlatten, pivot, resolveAggFunc } from './aggregation.engine';
import { ColumnDef } from '../types/column-def.types';
import { RowNode } from '../types/row-node.types';

interface Sale {
  region: string;
  quarter: string;
  revenue: number;
}

const node = (id: number, data: Sale): RowNode<Sale> => ({
  id,
  data,
  rowIndex: id,
  level: 0,
  pinned: null,
  isGroup: false,
  expanded: false,
});

const SALES: RowNode<Sale>[] = [
  node(0, { region: 'EMEA', quarter: 'Q1', revenue: 100 }),
  node(1, { region: 'EMEA', quarter: 'Q2', revenue: 300 }),
  node(2, { region: 'AMER', quarter: 'Q1', revenue: 500 }),
];

const COLUMNS: ColumnDef<Sale>[] = [
  { field: 'region' },
  { field: 'quarter' },
  { field: 'revenue', aggFunc: 'sum' },
];

describe('aggregation engine', () => {
  it('resolves built-in agg functions', () => {
    expect(resolveAggFunc('sum')([1, 2, 3])).toBe(6);
    expect(resolveAggFunc('avg')([2, 4])).toBe(3);
    expect(resolveAggFunc('min')([5, 1])).toBe(1);
    expect(resolveAggFunc('max')([5, 1])).toBe(5);
    expect(resolveAggFunc('count')(['a', 'b'])).toBe(2);
    expect(resolveAggFunc('first')(['a', 'b'])).toBe('a');
    expect(resolveAggFunc('last')(['a', 'b'])).toBe('b');
  });

  it('supports custom agg functions', () => {
    const median = resolveAggFunc((values: readonly unknown[]) => {
      const ns = values.map(Number).sort((a, b) => a - b);
      return ns[Math.floor(ns.length / 2)];
    });
    expect(median([3, 1, 2])).toBe(2);
  });

  it('aggregates leaves per aggFunc column', () => {
    const agg = aggregate(SALES, COLUMNS);
    expect(agg['revenue']).toBe(900);
  });

  it('groups rows and computes subtotals per group', () => {
    const flat = groupAndFlatten(SALES, [COLUMNS[0]], COLUMNS, new Set(), true);
    const groups = flat.filter((n) => n.isGroup);
    expect(groups).toHaveLength(2);
    const emea = groups.find((g) => g.groupKey === 'EMEA');
    expect(emea?.aggData?.['revenue']).toBe(400);
    expect(emea?.leafCount).toBe(2);
    // defaultExpanded=true flattens leaves under their groups
    expect(flat).toHaveLength(5);
  });

  it('collapsed groups hide their leaves', () => {
    const flat = groupAndFlatten(SALES, [COLUMNS[0]], COLUMNS, new Set(), false);
    expect(flat.every((n) => n.isGroup)).toBe(true);
  });

  it('pivot generates columns from distinct values', () => {
    const cols: ColumnDef<Sale>[] = [
      { field: 'region', rowGroup: true },
      { field: 'quarter', pivot: true },
      { field: 'revenue', aggFunc: 'sum' },
    ];
    const result = pivot(SALES.map((n) => n.data), cols);
    expect(result.columns.map((c) => c.colId)).toEqual(['pivot_Q1_revenue', 'pivot_Q2_revenue']);
    const emea = result.rows.find((r) => r['region'] === 'EMEA');
    expect(emea?.['pivot_Q1_revenue']).toBe(100);
    expect(emea?.['pivot_Q2_revenue']).toBe(300);
    const amer = result.rows.find((r) => r['region'] === 'AMER');
    expect(amer?.['pivot_Q2_revenue']).toBeNull();
  });

  it.todo('multi-level grouping nests group paths correctly');
  it.todo('tree flattening respects lazy children markers');
});
