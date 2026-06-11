/**
 * Row + column virtualization engine.
 *
 * Pure signal math — no DOM access. The component writes `scrollTop`,
 * `scrollLeft`, and `viewportSize`; everything else is `computed`, so a
 * scroll tick only re-evaluates the bindings that actually changed.
 *
 * Row heights:
 *  - fixed:   O(1) index↔offset math
 *  - dynamic: per-row callback, prefix-sum cache + binary search
 *  - auto:    measured heights reported via `setMeasuredHeight`, cache is
 *             invalidated from the first dirty index (amortized O(log n))
 */
import { Injectable, Signal, computed, signal } from '@angular/core';

export interface IndexRange {
  /** Inclusive. */
  start: number;
  /** Exclusive. */
  end: number;
}

type HeightMode =
  | { kind: 'fixed'; height: number }
  | { kind: 'dynamic'; getHeight: (index: number) => number }
  | { kind: 'auto'; estimate: number };

@Injectable()
export class VirtualScrollEngine {
  // ── Inputs (written by the grid component) ─────────────────────
  readonly scrollTop = signal(0);
  readonly scrollLeft = signal(0);
  readonly viewportHeight = signal(0);
  readonly viewportWidth = signal(0);
  readonly rowCount = signal(0);
  readonly overscan = signal(4);
  /** Visible column widths in display order (pinned columns excluded). */
  readonly columnWidths = signal<readonly number[]>([]);
  /** Extra columns rendered either side of the horizontal viewport. */
  readonly columnOverscan = signal(2);

  private heightMode: HeightMode = { kind: 'fixed', height: 36 };
  /** Measured heights for 'auto' mode, sparse. */
  private measured = new Map<number, number>();
  /** Prefix sums: offsets[i] = top offset of row i; offsets[n] = total height. */
  private offsets: number[] = [0];
  /** First index whose cached offset is stale (Infinity = clean). */
  private dirtyFrom = 0;
  /** Bumped to invalidate computeds when the offset cache changes shape. */
  private readonly heightVersion = signal(0);

  // ── Derived state ──────────────────────────────────────────────

  readonly totalHeight: Signal<number> = computed(() => {
    this.heightVersion();
    const n = this.rowCount();
    if (this.heightMode.kind === 'fixed') return n * this.heightMode.height;
    this.ensureOffsets(n);
    return this.offsets[n];
  });

  /** Visible row window including overscan. */
  readonly rowRange: Signal<IndexRange> = computed(() => {
    this.heightVersion();
    const n = this.rowCount();
    if (n === 0) return { start: 0, end: 0 };
    const top = this.scrollTop();
    const bottom = top + this.viewportHeight();
    const over = this.overscan();

    let first: number;
    let last: number;
    if (this.heightMode.kind === 'fixed') {
      const h = this.heightMode.height;
      first = Math.floor(top / h);
      last = Math.ceil(bottom / h);
    } else {
      this.ensureOffsets(n);
      first = this.findIndexForOffset(top);
      last = this.findIndexForOffset(bottom) + 1;
    }
    return {
      start: Math.max(0, first - over),
      end: Math.min(n, last + over),
    };
  });

  /** Visible column window (center section only) including overscan. */
  readonly colRange: Signal<IndexRange> = computed(() => {
    const widths = this.columnWidths();
    if (widths.length === 0) return { start: 0, end: 0 };
    const left = this.scrollLeft();
    const right = left + this.viewportWidth();
    const over = this.columnOverscan();

    let x = 0;
    let start = widths.length - 1;
    let end = widths.length;
    for (let i = 0; i < widths.length; i++) {
      const next = x + widths[i];
      if (next > left) {
        start = i;
        break;
      }
      x = next;
    }
    for (let i = start; i < widths.length; i++) {
      if (x >= right) {
        end = i;
        break;
      }
      x += widths[i];
    }
    return {
      start: Math.max(0, start - over),
      end: Math.min(widths.length, end + over),
    };
  });

  /** Pixel offset of the first rendered column (for translateX of the slice). */
  readonly colRangeOffset: Signal<number> = computed(() => {
    const widths = this.columnWidths();
    const { start } = this.colRange();
    let x = 0;
    for (let i = 0; i < start; i++) x += widths[i];
    return x;
  });

  /** Recycling pool size: stable while the viewport size is stable. */
  readonly poolSize: Signal<number> = computed(() => {
    const { start, end } = this.rowRange();
    return Math.max(1, end - start);
  });

  // ── Configuration ──────────────────────────────────────────────

  setFixedRowHeight(height: number): void {
    this.heightMode = { kind: 'fixed', height };
    this.invalidateFrom(0);
  }

  setDynamicRowHeight(getHeight: (index: number) => number): void {
    this.heightMode = { kind: 'dynamic', getHeight };
    this.invalidateFrom(0);
  }

  setAutoRowHeight(estimate: number): void {
    this.heightMode = { kind: 'auto', estimate };
    this.measured.clear();
    this.invalidateFrom(0);
  }

  /** Report a measured height ('auto' mode). No-op if unchanged. */
  setMeasuredHeight(index: number, height: number): void {
    if (this.heightMode.kind !== 'auto') return;
    if (this.measured.get(index) === height) return;
    this.measured.set(index, height);
    this.invalidateFrom(index);
  }

  /** Call when rows are inserted/removed/re-sorted before `index`. */
  invalidateFrom(index: number): void {
    this.dirtyFrom = Math.min(this.dirtyFrom, index);
    this.heightVersion.update((v) => v + 1);
  }

  // ── Lookups ────────────────────────────────────────────────────

  /** Top pixel offset of a row. */
  offsetOf(index: number): number {
    if (this.heightMode.kind === 'fixed') return index * this.heightMode.height;
    this.ensureOffsets(Math.max(index, this.rowCount()));
    return this.offsets[index];
  }

  heightOf(index: number): number {
    switch (this.heightMode.kind) {
      case 'fixed':
        return this.heightMode.height;
      case 'dynamic':
        return this.heightMode.getHeight(index);
      case 'auto':
        return this.measured.get(index) ?? this.heightMode.estimate;
    }
  }

  /**
   * scrollTop required to bring `index` into view.
   * Returns null when the row is already fully visible.
   */
  scrollTopForIndex(index: number, align: 'start' | 'end' | 'nearest' = 'nearest'): number | null {
    const top = this.offsetOf(index);
    const bottom = top + this.heightOf(index);
    const viewTop = this.scrollTop();
    const viewBottom = viewTop + this.viewportHeight();
    if (align === 'start') return top;
    if (align === 'end') return bottom - this.viewportHeight();
    if (top >= viewTop && bottom <= viewBottom) return null;
    return top < viewTop ? top : bottom - this.viewportHeight();
  }

  // ── Internals ──────────────────────────────────────────────────

  /** Rebuild the prefix-sum cache from the first dirty index up to `n`. */
  private ensureOffsets(n: number): void {
    if (this.heightMode.kind === 'fixed') return;
    const from = Math.min(this.dirtyFrom, this.offsets.length - 1);
    if (from >= n && this.offsets.length > n) {
      return;
    }
    if (this.offsets.length < n + 1) this.offsets.length = n + 1;
    let acc = this.offsets[from] ?? 0;
    for (let i = from; i < n; i++) {
      acc += this.heightOf(i);
      this.offsets[i + 1] = acc;
    }
    this.offsets.length = n + 1;
    this.dirtyFrom = Infinity;
  }

  /** Binary search: largest index whose offset ≤ y. */
  private findIndexForOffset(y: number): number {
    const n = this.rowCount();
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsets[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
