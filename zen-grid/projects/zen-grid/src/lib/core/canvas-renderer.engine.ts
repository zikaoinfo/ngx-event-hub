/**
 * Canvas paint path for ultra-high row counts (100k+).
 *
 * Paints only the visible row/column window into a single <canvas>, batched
 * through requestAnimationFrame so multiple signal writes per frame coalesce
 * into one paint. A one-cell DOM overlay (owned by the component) preserves
 * focus, editing and accessibility on top of the canvas.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ColumnDef, colIdOf } from '../types/column-def.types';
import { RowNode } from '../types/row-node.types';
import { VirtualScrollEngine } from './virtual-scroll.engine';
import { SortFilterEngine } from './sort-filter.engine';

export interface CanvasTheme {
  font: string;
  rowHeight: number;
  background: string;
  altBackground: string;
  textColor: string;
  gridLineColor: string;
  selectedBackground: string;
  cellPaddingX: number;
}

const DEFAULT_CANVAS_THEME: CanvasTheme = {
  font: '13px system-ui, sans-serif',
  rowHeight: 36,
  background: '#ffffff',
  altBackground: '#fafafa',
  textColor: '#1f2937',
  gridLineColor: '#e5e7eb',
  selectedBackground: '#dbeafe',
  cellPaddingX: 12,
};

@Injectable()
export class CanvasRendererEngine<T extends object = object> {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly viewport = inject(VirtualScrollEngine);
  private readonly sortFilter = inject(SortFilterEngine<T>);

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private theme: CanvasTheme = DEFAULT_CANVAS_THEME;

  attach(canvas: HTMLCanvasElement, theme?: Partial<CanvasTheme>): void {
    // SSR-GUARD: canvas 2D contexts only exist in the browser.
    if (!isPlatformBrowser(this.platformId)) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = { ...DEFAULT_CANVAS_THEME, ...theme };
  }

  detach(): void {
    // SSR-GUARD
    if (this.rafId !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Schedule a paint. Multiple calls within one frame coalesce — the actual
   * draw happens once in the next animation frame.
   */
  schedulePaint(
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
    selectedIndices: ReadonlySet<number>,
  ): void {
    // SSR-GUARD: requestAnimationFrame is browser-only.
    if (!isPlatformBrowser(this.platformId) || !this.ctx) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.paint(rows, columns, selectedIndices);
    });
  }

  private paint(
    rows: readonly RowNode<T>[],
    columns: readonly ColumnDef<T>[],
    selectedIndices: ReadonlySet<number>,
  ): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const width = this.viewport.viewportWidth();
    const height = this.viewport.viewportHeight();
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t = this.theme;
    const scrollTop = this.viewport.scrollTop();
    const scrollLeft = this.viewport.scrollLeft();
    const { start, end } = this.viewport.rowRange();
    const colRange = this.viewport.colRange();
    const widths = this.viewport.columnWidths();

    ctx.fillStyle = t.background;
    ctx.fillRect(0, 0, width, height);
    ctx.font = t.font;
    ctx.textBaseline = 'middle';

    // Column x-offsets for the painted slice.
    let x0 = 0;
    for (let c = 0; c < colRange.start; c++) x0 += widths[c];

    for (let r = start; r < Math.min(end, rows.length); r++) {
      const node = rows[r];
      const y = this.viewport.offsetOf(r) - scrollTop;
      const h = this.viewport.heightOf(r);
      if (y + h < 0 || y > height) continue;

      // Row background (zebra + selection).
      ctx.fillStyle = selectedIndices.has(r)
        ? t.selectedBackground
        : r % 2 === 1
          ? t.altBackground
          : t.background;
      ctx.fillRect(0, y, width, h);

      // Cells.
      let x = x0 - scrollLeft;
      ctx.fillStyle = t.textColor;
      for (let c = colRange.start; c < Math.min(colRange.end, columns.length); c++) {
        const col = columns[c];
        const w = widths[c] ?? 100;
        const text = this.sortFilter.displayValue(node.data, col);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillText(this.ellipsize(ctx, text, w - 2 * t.cellPaddingX), x + t.cellPaddingX, y + h / 2);
        ctx.restore();
        x += w;
      }

      // Row separator.
      ctx.strokeStyle = t.gridLineColor;
      ctx.beginPath();
      ctx.moveTo(0, y + h - 0.5);
      ctx.lineTo(width, y + h - 0.5);
      ctx.stroke();
    }

    // Vertical grid lines for the painted column slice.
    ctx.strokeStyle = t.gridLineColor;
    let vx = x0 - scrollLeft;
    for (let c = colRange.start; c < Math.min(colRange.end, columns.length); c++) {
      vx += widths[c] ?? 100;
      ctx.beginPath();
      ctx.moveTo(vx - 0.5, 0);
      ctx.lineTo(vx - 0.5, height);
      ctx.stroke();
    }
  }

  /** Hit-test a pointer event back to a (rowIndex, colId) cell. */
  cellAt(offsetX: number, offsetY: number, columns: readonly ColumnDef<T>[]): { rowIndex: number; colId: string } | null {
    const y = offsetY + this.viewport.scrollTop();
    const x = offsetX + this.viewport.scrollLeft();
    const n = this.viewport.rowCount();
    let rowIndex = -1;
    for (let r = 0; r < n; r++) {
      const top = this.viewport.offsetOf(r);
      if (y >= top && y < top + this.viewport.heightOf(r)) {
        rowIndex = r;
        break;
      }
      if (top > y) break;
    }
    if (rowIndex === -1) return null;
    const widths = this.viewport.columnWidths();
    let acc = 0;
    for (let c = 0; c < widths.length; c++) {
      acc += widths[c];
      if (x < acc) return { rowIndex, colId: colIdOf(columns[c]) };
    }
    return null;
  }

  private ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (maxWidth <= 0) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, lo) + '…';
  }
}
