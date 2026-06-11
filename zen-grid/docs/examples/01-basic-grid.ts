/**
 * Example 1 — Basic setup with typed ColumnDef<T>.
 *
 * `field` paths are typed and autocompleted (including nested paths like
 * 'address.city'); `col<T, V>()` pins the value type for per-column callbacks.
 */
import { Component, signal } from '@angular/core';
import {
  ZenGridComponent,
  ColDefOrGroup,
  GridOptions,
  col,
  textColumn,
  currencyColumn,
  dateColumn,
  booleanColumn,
} from 'zen-grid';

interface Trade {
  id: number;
  ticker: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  executedAt: Date;
  settled: boolean;
  counterparty: { name: string; country: string };
}

@Component({
  selector: 'app-basic-grid',
  standalone: true,
  imports: [ZenGridComponent],
  template: `
    <zen-grid
      style="height: 480px"
      [rowData]="trades"
      [columnDefs]="columnDefs"
      [options]="options"
      theme="zen-arctic"
      darkMode="auto"
      (rowClicked)="onRowClicked($event.row)"
      (sortChanged)="onSortChanged()"
    />
  `,
})
export class BasicGridComponent {
  // rowData also accepts Signal<Trade[]> or Observable<Trade[]> directly.
  readonly trades = signal<Trade[]>([
    {
      id: 1,
      ticker: 'AAPL',
      side: 'buy',
      price: 187.4,
      quantity: 250,
      executedAt: new Date('2026-05-12T09:30:00Z'),
      settled: true,
      counterparty: { name: 'Acme Capital', country: 'US' },
    },
    {
      id: 2,
      ticker: 'MSFT',
      side: 'sell',
      price: 415.1,
      quantity: 120,
      executedAt: new Date('2026-05-12T10:02:00Z'),
      settled: false,
      counterparty: { name: 'Borealis AM', country: 'NO' },
    },
  ]);

  readonly columnDefs: ColDefOrGroup<Trade>[] = [
    textColumn<Trade>('ticker', { pinned: 'left', width: 110 }),
    col<Trade, 'buy' | 'sell'>({
      field: 'side',
      filter: 'set',
      cellClass: ({ value }) => (value === 'buy' ? 'side-buy' : 'side-sell'),
    }),
    currencyColumn<Trade>('price', { currency: 'USD' }),
    col<Trade, number>({
      field: 'quantity',
      filter: 'number',
      editable: true,
      validators: [(v) => ({ valid: v > 0, message: 'Quantity must be positive' })],
    }),
    dateColumn<Trade>('executedAt'),
    booleanColumn<Trade>('settled'),
    // Typed nested field path — autocompletes 'counterparty.name'.
    textColumn<Trade>('counterparty.name', { headerName: 'Counterparty' }),
  ];

  readonly options: GridOptions<Trade> = {
    getRowId: (t) => t.id,
    immutableData: true,
    selection: { mode: 'multiple', checkboxes: true, rangeSelect: true },
    rowHeight: { mode: 'fixed', height: 36 },
    statePersistence: { strategy: 'localStorage', key: 'trades-grid' },
    ariaLabel: 'Trades',
  };

  onRowClicked(trade: Trade): void {
    console.log('clicked', trade.ticker);
  }

  onSortChanged(): void {
    console.log('sort model changed');
  }
}
