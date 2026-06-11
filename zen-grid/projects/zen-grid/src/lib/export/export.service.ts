/**
 * Export pipeline.
 *
 * CSV is dependency-free and generated through a streaming generator —
 * constant memory even for very large datasets. Excel and PDF are pluggable
 * adapter interfaces so apps bring their own xlsx/pdf library while ZenGrid
 * stays at zero runtime dependencies.
 *
 * All exports operate on the *processed* rows (current filter + sort) and the
 * *visible* columns, and honor per-column exportFormatter/valueFormatter.
 */
import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ColumnDef, colIdOf, defaultHeaderName, getByPath } from '../types/column-def.types';
import { RowNode } from '../types/row-node.types';
import { formatDefault } from '../core/sort-filter.engine';

export interface CsvExportOptions {
  delimiter?: string;
  includeHeader?: boolean;
  /** Include group rows (rendered as indented labels). Default false. */
  includeGroups?: boolean;
  /** Only export selected rows. Default false. */
  selectedOnly?: boolean;
  /** Rows per streamed chunk. Default 1000. */
  chunkSize?: number;
}

/** One sheet of tabular data handed to the Excel/PDF adapters. */
export interface ExportSheet {
  name: string;
  header: readonly string[];
  rows: readonly (readonly string[])[];
}

/** App-provided adapter: implement with exceljs/sheetjs/etc. */
export interface ZenExcelAdapter {
  exportExcel(fileName: string, sheet: ExportSheet): Promise<void>;
}

/** App-provided adapter: implement with pdfmake/jsPDF/etc. */
export interface ZenPdfAdapter {
  exportPdf(fileName: string, sheet: ExportSheet): Promise<void>;
}

export const ZEN_EXCEL_ADAPTER = new InjectionToken<ZenExcelAdapter>('ZEN_EXCEL_ADAPTER');
export const ZEN_PDF_ADAPTER = new InjectionToken<ZenPdfAdapter>('ZEN_PDF_ADAPTER');

@Injectable()
export class ExportService<T extends object = object> {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly excelAdapter = inject(ZEN_EXCEL_ADAPTER, { optional: true });
  private readonly pdfAdapter = inject(ZEN_PDF_ADAPTER, { optional: true });

  // ── CSV ────────────────────────────────────────────────────────

  /** Materialize the full CSV string (small/medium datasets). */
  toCsv(
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
    options: CsvExportOptions = {},
  ): string {
    let out = '';
    for (const chunk of this.csvChunks(rows, columns, options)) out += chunk;
    return out;
  }

  /**
   * Streaming generator: yields CSV text in chunks of `chunkSize` rows so
   * huge datasets never build one giant intermediate array.
   */
  *csvChunks(
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
    options: CsvExportOptions = {},
  ): Generator<string, void, undefined> {
    const delimiter = options.delimiter ?? ',';
    const chunkSize = options.chunkSize ?? 1000;
    const lines: string[] = [];

    if (options.includeHeader !== false) {
      lines.push(
        columns
          .map((c) => escapeCsv(c.headerName ?? defaultHeaderName(colIdOf(c)), delimiter))
          .join(delimiter),
      );
    }

    for (const node of rows) {
      if (node.isGroup) {
        if (options.includeGroups) {
          const label = `${'  '.repeat(node.level)}${String(node.groupKey ?? '')} (${node.leafCount ?? 0})`;
          lines.push(escapeCsv(label, delimiter));
        }
      } else {
        lines.push(
          columns.map((c) => escapeCsv(this.exportValue(node.data, c), delimiter)).join(delimiter),
        );
      }
      if (lines.length >= chunkSize) {
        yield lines.join('\r\n') + '\r\n';
        lines.length = 0;
      }
    }
    if (lines.length > 0) yield lines.join('\r\n') + '\r\n';
  }

  downloadCsv(
    fileName: string,
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
    options: CsvExportOptions = {},
  ): void {
    // SSR-GUARD: Blob/anchor download is browser-only.
    if (!isPlatformBrowser(this.platformId)) return;
    const parts: string[] = ['﻿']; // BOM for Excel UTF-8 detection
    for (const chunk of this.csvChunks(rows, columns, options)) parts.push(chunk);
    const blob = new Blob(parts, { type: 'text/csv;charset=utf-8' });
    this.triggerDownload(blob, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  }

  // ── Excel / PDF via adapters ───────────────────────────────────

  async toExcel(
    fileName: string,
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
  ): Promise<void> {
    if (!this.excelAdapter) {
      throw new Error(
        '[ZenGrid] No Excel adapter registered. Provide ZEN_EXCEL_ADAPTER with an ' +
          'implementation of ZenExcelAdapter (e.g. backed by exceljs).',
      );
    }
    await this.excelAdapter.exportExcel(fileName, this.buildSheet(rows, columns));
  }

  async toPdf(
    fileName: string,
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
  ): Promise<void> {
    if (!this.pdfAdapter) {
      throw new Error(
        '[ZenGrid] No PDF adapter registered. Provide ZEN_PDF_ADAPTER with an ' +
          'implementation of ZenPdfAdapter (e.g. backed by pdfmake).',
      );
    }
    await this.pdfAdapter.exportPdf(fileName, this.buildSheet(rows, columns));
  }

  buildSheet(rows: readonly RowNode<T>[], columns: readonly ColumnDef<T>[]): ExportSheet {
    return {
      name: 'ZenGrid Export',
      header: columns.map((c) => c.headerName ?? defaultHeaderName(colIdOf(c))),
      rows: rows
        .filter((n) => !n.isGroup)
        .map((n) => columns.map((c) => this.exportValue(n.data, c))),
    };
  }

  // ── Internals ──────────────────────────────────────────────────

  private exportValue(row: T, col: ColumnDef<T>): string {
    const raw = col.valueGetter
      ? col.valueGetter(row, undefined as never)
      : col.field
        ? getByPath(row, col.field as string)
        : undefined;
    if (col.exportFormatter) return col.exportFormatter(raw, row);
    if (col.valueFormatter) return col.valueFormatter(raw, row);
    return formatDefault(raw);
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    // SSR-GUARD (callers already guard, kept defensive for direct use)
    if (!isPlatformBrowser(this.platformId)) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function escapeCsv(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
