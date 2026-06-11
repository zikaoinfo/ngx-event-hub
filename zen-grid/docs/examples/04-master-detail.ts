/**
 * Example 4 — Master-detail with a nested grid.
 *
 * The detail renderer is a normal ZenCellRenderer component; here it embeds
 * a second <zen-grid> (each grid has its own DI scope, so nesting is safe).
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ZenGridComponent,
  ZenCellRenderer,
  CellRendererParams,
  ColDefOrGroup,
  GridOptions,
  textColumn,
  numberColumn,
  currencyColumn,
} from 'zen-grid';

interface Invoice {
  invoiceNo: string;
  customer: string;
  total: number;
  lines: InvoiceLine[];
}

interface InvoiceLine {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ZenGridComponent],
  template: `
    <div style="padding: 8px; height: 100%; box-sizing: border-box">
      <zen-grid style="height: 100%" [rowData]="lines()" [columnDefs]="lineColumns" theme="zen-slate" />
    </div>
  `,
})
export class InvoiceDetailComponent implements ZenCellRenderer<Invoice> {
  readonly lines = signal<InvoiceLine[]>([]);

  readonly lineColumns: ColDefOrGroup<InvoiceLine>[] = [
    textColumn<InvoiceLine>('sku', { width: 120 }),
    textColumn<InvoiceLine>('description', { flex: 1 }),
    numberColumn<InvoiceLine>('qty'),
    currencyColumn<InvoiceLine>('unitPrice'),
  ];

  zenInit(params: CellRendererParams<Invoice>): void {
    this.lines.set(params.row.lines);
  }

  zenRefresh(params: CellRendererParams<Invoice>): boolean {
    this.lines.set(params.row.lines);
    return true;
  }
}

@Component({
  selector: 'app-master-detail-grid',
  standalone: true,
  imports: [ZenGridComponent],
  template: `<zen-grid style="height: 600px" [rowData]="invoices" [columnDefs]="columnDefs" [options]="options" />`,
})
export class MasterDetailGridComponent {
  readonly invoices: Invoice[] = [
    {
      invoiceNo: 'INV-1001',
      customer: 'Globex',
      total: 1240.5,
      lines: [
        { sku: 'A-100', description: 'Widget', qty: 10, unitPrice: 24.05 },
        { sku: 'B-220', description: 'Gadget', qty: 5, unitPrice: 200.0 },
      ],
    },
    {
      invoiceNo: 'INV-1002',
      customer: 'Initech',
      total: 380.0,
      lines: [{ sku: 'C-310', description: 'Sprocket', qty: 19, unitPrice: 20.0 }],
    },
  ];

  readonly columnDefs: ColDefOrGroup<Invoice>[] = [
    textColumn<Invoice>('invoiceNo', { width: 140 }),
    textColumn<Invoice>('customer', { flex: 1 }),
    currencyColumn<Invoice>('total'),
  ];

  readonly options: GridOptions<Invoice> = {
    getRowId: (i) => i.invoiceNo,
    detailRenderer: InvoiceDetailComponent,
    detailRowHeight: 220,
  };
}
