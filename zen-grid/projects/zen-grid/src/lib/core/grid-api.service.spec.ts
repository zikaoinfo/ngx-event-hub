import { TestBed } from '@angular/core/testing';
import { GridApiService } from './grid-api.service';
import { DataSourceService } from './data-source.service';
import { SortFilterEngine } from './sort-filter.engine';
import { SelectionManager } from './selection.manager';
import { ColumnStateManager } from './column-state.manager';
import { VirtualScrollEngine } from './virtual-scroll.engine';
import { ExportService } from '../export/export.service';

interface Item {
  id: number;
  label: string;
}

describe('GridApiService (facade)', () => {
  let api: GridApiService<Item>;
  let dataSource: DataSourceService<Item>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GridApiService,
        DataSourceService,
        SortFilterEngine,
        SelectionManager,
        ColumnStateManager,
        VirtualScrollEngine,
        ExportService,
      ],
    });
    api = TestBed.inject(GridApiService<Item>);
    dataSource = TestBed.inject(DataSourceService<Item>);
    dataSource.configure({ getRowId: (r) => r.id });
    TestBed.inject(ColumnStateManager<Item>).setColumnDefs([{ field: 'label', colId: 'label' }]);
    dataSource.columns.set([{ field: 'label', colId: 'label' }]);
    api.setRowData([{ id: 1, label: 'beta' }, { id: 2, label: 'alpha' }]);
  });

  it('setRowData → getDisplayedRows round-trip', () => {
    expect(api.getDisplayedRows()).toHaveLength(2);
  });

  it('setSortModel re-orders displayed rows', () => {
    api.setSortModel([{ colId: 'label', direction: 'asc', priority: 0 }]);
    expect(api.getDisplayedRows().map((n) => n.data.label)).toEqual(['alpha', 'beta']);
  });

  it('setQuickFilter narrows displayed rows', () => {
    api.setQuickFilter('alpha');
    expect(api.getDisplayedRows()).toHaveLength(1);
  });

  it('applyTransaction + undo flow through the facade', () => {
    api.applyTransaction({ add: [{ id: 3, label: 'c' }] });
    expect(api.getDisplayedRows()).toHaveLength(3);
    expect(api.canUndo()).toBe(true);
    api.undo();
    expect(api.getDisplayedRows()).toHaveLength(2);
  });

  it('column state passthrough (visible/width/pin)', () => {
    api.setColumnWidth('label', 321);
    expect(api.getColumnState()[0].width).toBe(321);
    api.setColumnVisible('label', false);
    expect(api.getVisibleColumns()).toHaveLength(0);
  });

  it('exportCsv reflects the current filter', () => {
    api.setQuickFilter('alpha');
    const csv = api.exportCsv();
    expect(csv).toContain('alpha');
    expect(csv).not.toContain('beta');
  });

  it('inspectState exposes a DevTools snapshot', () => {
    const state = api.inspectState();
    expect(state['rowCount']).toBe(2);
    expect(state['columnState']).toBeDefined();
  });

  it.todo('ensureIndexVisible delegates to the registered UI hooks');
  it.todo('startEditingCell scrolls the target row into view first');
});
