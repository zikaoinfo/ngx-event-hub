/**
 * Example 5 — Row grouping with aggregation, and pivot mode.
 *
 * Grouping/aggregation is declarative on the column defs (rowGroup/aggFunc).
 * Pivot mode uses the standalone `pivot()` engine to generate columns from
 * distinct row values, then feeds the result back into a grid.
 */
import { Component, computed, signal } from '@angular/core';
import {
  ZenGridComponent,
  ColDefOrGroup,
  ColumnDef,
  GridOptions,
  col,
  pivot,
  textColumn,
  currencyColumn,
} from 'zen-grid';

interface Sale {
  region: string;
  country: string;
  quarter: string;
  product: string;
  revenue: number;
}

const SALES: Sale[] = [
  { region: 'EMEA', country: 'DE', quarter: 'Q1', product: 'Pro', revenue: 12000 },
  { region: 'EMEA', country: 'FR', quarter: 'Q1', product: 'Lite', revenue: 4300 },
  { region: 'EMEA', country: 'DE', quarter: 'Q2', product: 'Pro', revenue: 15800 },
  { region: 'AMER', country: 'US', quarter: 'Q1', product: 'Pro', revenue: 30100 },
  { region: 'AMER', country: 'US', quarter: 'Q2', product: 'Lite', revenue: 9800 },
  { region: 'APAC', country: 'JP', quarter: 'Q2', product: 'Pro', revenue: 11200 },
];

@Component({
  selector: 'app-grouped-grid',
  standalone: true,
  imports: [ZenGridComponent],
  template: `
    <!-- Grouped view: region ▸ country with sum/avg subtotals on group rows. -->
    <zen-grid style="height: 420px" [rowData]="sales" [columnDefs]="groupedColumns" [options]="groupedOptions" />

    <!-- Pivot view: quarters become generated columns. -->
    <zen-grid style="height: 320px" [rowData]="pivotRows()" [columnDefs]="pivotColumns()" />
  `,
})
export class GroupedGridComponent {
  readonly sales = SALES;

  // ── Grouping + aggregation ──────────────────────────────────────
  readonly groupedColumns: ColDefOrGroup<Sale>[] = [
    textColumn<Sale>('region', { rowGroup: true, rowGroupIndex: 0, hide: true }),
    textColumn<Sale>('country', { rowGroup: true, rowGroupIndex: 1, hide: true }),
    textColumn<Sale>('product'),
    currencyColumn<Sale>('revenue', { aggFunc: 'sum' }),
    col<Sale, number>({
      colId: 'avgRevenue',
      headerName: 'Avg Revenue',
      valueGetter: (row) => row.revenue,
      aggFunc: 'avg',
      valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(0) : ''),
    }),
  ];

  readonly groupedOptions: GridOptions<Sale> = {
    grouping: { subtotals: true, grandTotalRow: 'bottom', defaultExpanded: 1 },
  };

  // ── Pivot mode ──────────────────────────────────────────────────
  private readonly pivotSource = signal(SALES);

  private readonly pivotConfig: ColumnDef<Sale>[] = [
    { field: 'region', rowGroup: true },
    { field: 'quarter', pivot: true },
    { field: 'revenue', aggFunc: 'sum' },
  ];

  readonly pivotResult = computed(() => pivot(this.pivotSource(), this.pivotConfig));

  readonly pivotRows = computed(() => this.pivotResult().rows);
  readonly pivotColumns = computed<ColDefOrGroup<Record<string, unknown>>[]>(() => [
    { colId: 'region', headerName: 'Region', valueGetter: (r) => r['region'] },
    ...(this.pivotResult().columns as ColumnDef<Record<string, unknown>>[]),
  ]);
}
