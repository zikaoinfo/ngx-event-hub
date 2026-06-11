import { TestBed } from '@angular/core/testing';
import { DataSourceService } from './data-source.service';
import { SortFilterEngine } from './sort-filter.engine';
import { SelectionManager } from './selection.manager';

interface Item {
  id: number;
  label: string;
}

describe('SelectionManager', () => {
  let selection: SelectionManager<Item>;
  let dataSource: DataSourceService<Item>;

  const noKeys = { shiftKey: false, ctrlKey: false, metaKey: false };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SelectionManager, DataSourceService, SortFilterEngine],
    });
    dataSource = TestBed.inject(DataSourceService<Item>);
    selection = TestBed.inject(SelectionManager<Item>);
    dataSource.configure({ getRowId: (r) => r.id });
    dataSource.setRowData([1, 2, 3, 4, 5].map((id) => ({ id, label: `row${id}` })));
    selection.configure({ mode: 'multiple', rangeSelect: true });
  });

  const nodeAt = (i: number) => dataSource.processedRows()[i];

  it('selects a single row on plain click', () => {
    selection.handleRowClick(nodeAt(1), noKeys);
    expect(selection.selectedRows().map((r) => r.id)).toEqual([2]);
  });

  it('plain click replaces the previous selection', () => {
    selection.handleRowClick(nodeAt(0), noKeys);
    selection.handleRowClick(nodeAt(2), noKeys);
    expect(selection.selectedRows().map((r) => r.id)).toEqual([3]);
  });

  it('ctrl-click toggles rows into a multi-selection', () => {
    selection.handleRowClick(nodeAt(0), noKeys);
    selection.handleRowClick(nodeAt(2), { ...noKeys, ctrlKey: true });
    expect(selection.selectedIds().size).toBe(2);
    selection.handleRowClick(nodeAt(2), { ...noKeys, ctrlKey: true });
    expect(selection.selectedIds().size).toBe(1);
  });

  it('shift-click selects the range from the anchor', () => {
    selection.handleRowClick(nodeAt(1), noKeys);
    selection.handleRowClick(nodeAt(3), { ...noKeys, shiftKey: true });
    expect(selection.selectedRows().map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it('single mode keeps at most one row selected via toggle', () => {
    selection.configure({ mode: 'single' });
    selection.toggle(1);
    selection.toggle(2);
    expect([...selection.selectedIds()]).toEqual([2]);
  });

  it('header checkbox state reflects none/some/all', () => {
    expect(selection.headerCheckboxState()).toBe('none');
    selection.toggle(1);
    expect(selection.headerCheckboxState()).toBe('some');
    selection.selectAll();
    expect(selection.headerCheckboxState()).toBe('all');
    selection.toggleAll();
    expect(selection.headerCheckboxState()).toBe('none');
  });

  it('tracks rectangular cell ranges', () => {
    selection.configure({ mode: 'multiple', cellRanges: true });
    selection.startCellRange(1, 1, false);
    selection.extendCellRange(3, 2);
    expect(selection.isCellInRange(2, 2)).toBe(true);
    expect(selection.isCellInRange(0, 0)).toBe(false);
  });

  it.todo('clears selection when mode is set to none');
  it.todo('ignores group rows in selection');
});
