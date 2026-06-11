import { TestBed } from '@angular/core/testing';
import { ColumnStateManager } from './column-state.manager';
import { ColDefOrGroup } from '../types/column-def.types';

interface Item {
  a: string;
  b: number;
  c: boolean;
}

const DEFS: ColDefOrGroup<Item>[] = [
  { field: 'a', width: 100 },
  { field: 'b', width: 200, pinned: 'left' },
  { field: 'c', width: 50, minWidth: 40, maxWidth: 60 },
];

describe('ColumnStateManager', () => {
  let manager: ColumnStateManager<Item>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ColumnStateManager] });
    manager = TestBed.inject(ColumnStateManager<Item>);
    manager.setColumnDefs(DEFS);
  });

  it('initializes state from defs (order, width, pinning)', () => {
    expect(manager.columnStates().map((s) => s.colId)).toEqual(['a', 'b', 'c']);
    expect(manager.leftPinned().map((c) => c.field)).toEqual(['b']);
    expect(manager.centerColumns().map((c) => c.field)).toEqual(['a', 'c']);
  });

  it('orders visible leaves pinned-left → center → pinned-right', () => {
    manager.setPinned('c', 'right');
    expect(manager.visibleLeafColumns().map((c) => c.field)).toEqual(['b', 'a', 'c']);
  });

  it('clamps resize to min/max width', () => {
    manager.setWidth('c', 500);
    expect(manager.widthOf('c')).toBe(60);
    manager.setWidth('c', 1);
    expect(manager.widthOf('c')).toBe(40);
  });

  it('toggles visibility and respects lockVisible', () => {
    manager.setVisible('a', false);
    expect(manager.visibleLeafColumns().map((c) => c.field)).toEqual(['b', 'c']);
    manager.setColumnDefs([{ field: 'a', lockVisible: true }]);
    manager.setVisible('a', false);
    expect(manager.visibleLeafColumns()).toHaveLength(1);
  });

  it('moves columns to a new display index', () => {
    manager.move('c', 0);
    expect(manager.columnStates().map((s) => s.colId)).toEqual(['c', 'a', 'b']);
  });

  it('round-trips state through JSON (save/restore)', () => {
    manager.setWidth('a', 333);
    manager.move('c', 0);
    const json = JSON.stringify(manager.getColumnState());

    manager.resetColumnState();
    expect(manager.widthOf('a')).toBe(100);

    manager.applyColumnState(JSON.parse(json));
    expect(manager.widthOf('a')).toBe(333);
    expect(manager.columnStates()[0].colId).toBe('c');
  });

  it('builds a single header row for flat defs', () => {
    expect(manager.headerRows()).toHaveLength(1);
    expect(manager.headerRows()[0]).toHaveLength(3);
  });

  it('builds multi-level header rows for grouped defs', () => {
    manager.setColumnDefs([
      { field: 'a' },
      {
        isGroup: true,
        groupId: 'g1',
        headerName: 'Group',
        children: [{ field: 'b' }, { field: 'c' }],
      },
    ]);
    const rows = manager.headerRows();
    expect(rows).toHaveLength(2);
    const group = rows[0].find((c) => c.isGroup);
    expect(group?.colSpan).toBe(2);
  });

  it('distributes flex widths across free space', () => {
    manager.setColumnDefs([
      { field: 'a', width: 100 },
      { field: 'b', flex: 1 },
      { field: 'c', flex: 3 },
    ]);
    // Discard state carried over from the beforeEach defs (b was pinned).
    manager.resetColumnState();
    manager.applyFlex(500);
    expect(manager.widthOf('b')).toBe(100);
    expect(manager.widthOf('c')).toBe(300);
  });

  it.todo('persists state to localStorage when configured');
  it.todo('suppressMovable columns refuse to move');
});
