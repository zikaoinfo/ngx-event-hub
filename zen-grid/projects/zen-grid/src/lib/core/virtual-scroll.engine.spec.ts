import { TestBed } from '@angular/core/testing';
import { VirtualScrollEngine } from './virtual-scroll.engine';

describe('VirtualScrollEngine', () => {
  let engine: VirtualScrollEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [VirtualScrollEngine] });
    engine = TestBed.inject(VirtualScrollEngine);
    engine.setFixedRowHeight(40);
    engine.rowCount.set(10_000);
    engine.viewportHeight.set(400);
    engine.viewportWidth.set(800);
  });

  it('computes total height for fixed row heights', () => {
    expect(engine.totalHeight()).toBe(400_000);
  });

  it('computes the visible row range with overscan', () => {
    engine.overscan.set(2);
    engine.scrollTop.set(4000); // row 100 at the top
    const range = engine.rowRange();
    expect(range.start).toBe(98); // 100 - overscan
    expect(range.end).toBe(112); // ceil(4400/40) + overscan
  });

  it('clamps the range at dataset boundaries', () => {
    engine.scrollTop.set(0);
    expect(engine.rowRange().start).toBe(0);
    engine.scrollTop.set(400_000);
    expect(engine.rowRange().end).toBe(10_000);
  });

  it('supports dynamic per-row heights via prefix sums + binary search', () => {
    engine.rowCount.set(100);
    engine.setDynamicRowHeight((i) => (i % 2 === 0 ? 30 : 50));
    expect(engine.totalHeight()).toBe(50 * 30 + 50 * 50);
    expect(engine.offsetOf(2)).toBe(80);
    engine.scrollTop.set(80);
    expect(engine.rowRange().start).toBeLessThanOrEqual(2);
  });

  it('invalidates measured heights from the dirty index (auto mode)', () => {
    engine.rowCount.set(100);
    engine.setAutoRowHeight(40);
    expect(engine.totalHeight()).toBe(4000);
    engine.setMeasuredHeight(0, 100);
    expect(engine.totalHeight()).toBe(4060);
    expect(engine.offsetOf(1)).toBe(100);
  });

  it('virtualizes columns from scrollLeft + widths', () => {
    engine.columnWidths.set([100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    engine.columnOverscan.set(0);
    engine.viewportWidth.set(300);
    engine.scrollLeft.set(250);
    const range = engine.colRange();
    expect(range.start).toBe(2);
    expect(range.end).toBe(6);
    expect(engine.colRangeOffset()).toBe(200);
  });

  it('returns null from scrollTopForIndex when the row is already visible', () => {
    engine.scrollTop.set(0);
    expect(engine.scrollTopForIndex(2)).toBeNull();
    expect(engine.scrollTopForIndex(500)).toBe(500 * 40 + 40 - 400);
  });

  it.todo('re-measures offsets when rows are inserted before the viewport');
  it.todo('keeps poolSize stable while the viewport size is unchanged');
});
