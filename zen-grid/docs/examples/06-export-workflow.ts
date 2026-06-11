/**
 * Example 6 — Full export workflow: streamed CSV, plus Excel via a custom
 * adapter (here backed by exceljs, but any library works).
 *
 * Exports respect current filters, sort and column visibility, and use
 * exportFormatter/valueFormatter per column.
 */
import { Component, viewChild } from '@angular/core';
import {
  ZenGridComponent,
  ZEN_EXCEL_ADAPTER,
  ZenExcelAdapter,
  ExportSheet,
  ColDefOrGroup,
  col,
  textColumn,
  currencyColumn,
  dateColumn,
} from 'zen-grid';

interface Payment {
  reference: string;
  payee: string;
  amount: number;
  paidAt: Date;
}

/** App-provided Excel adapter — keeps ZenGrid itself dependency-free. */
class ExcelJsAdapter implements ZenExcelAdapter {
  async exportExcel(fileName: string, sheet: ExportSheet): Promise<void> {
    // Lazy-load so the xlsx library never lands in the main bundle.
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow([...sheet.header]);
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) ws.addRow([...row]);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

@Component({
  selector: 'app-export-grid',
  standalone: true,
  imports: [ZenGridComponent],
  providers: [{ provide: ZEN_EXCEL_ADAPTER, useClass: ExcelJsAdapter }],
  template: `
    <div class="toolbar">
      <input placeholder="Quick filter…" (input)="grid().api.setQuickFilter($any($event.target).value)" />
      <button (click)="grid().api.downloadCsv('payments')">Export CSV</button>
      <button (click)="grid().api.exportExcel('payments')">Export Excel</button>
    </div>
    <zen-grid style="height: 460px" [rowData]="payments" [columnDefs]="columnDefs" />
  `,
})
export class ExportGridComponent {
  readonly grid = viewChild.required(ZenGridComponent<Payment>);

  readonly payments: Payment[] = [
    { reference: 'PAY-77', payee: 'Vandelay', amount: 9100.4, paidAt: new Date('2026-04-02') },
    { reference: 'PAY-78', payee: 'Hooli', amount: 1280.0, paidAt: new Date('2026-04-05') },
  ];

  readonly columnDefs: ColDefOrGroup<Payment>[] = [
    textColumn<Payment>('reference'),
    textColumn<Payment>('payee'),
    currencyColumn<Payment>('amount', {
      // Display shows "$9,100.40" — exports get a machine-readable value.
      exportFormatter: (v) => (typeof v === 'number' ? v.toFixed(2) : ''),
    }),
    dateColumn<Payment>('paidAt', {
      exportFormatter: (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : ''),
    }),
    col<Payment, number>({
      colId: 'amountWithVat',
      headerName: 'Incl. VAT',
      valueGetter: (row) => row.amount * 1.2,
      valueFormatter: (v) => v.toFixed(2),
    }),
  ];
}
