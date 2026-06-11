import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DataSourceService } from './data-source.service';
import { SortFilterEngine } from './sort-filter.engine';
import { GetRowsParams, GetRowsResult } from '../types/grid-options.types';

interface Item {
  id: number;
  label: string;
}

describe('DataSourceService', () => {
  let service: DataSourceService<Item>;
  let sortFilter: SortFilterEngine<Item>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DataSourceService, SortFilterEngine] });
    service = TestBed.inject(DataSourceService<Item>);
    sortFilter = TestBed.inject(SortFilterEngine<Item>);
    service.configure({ getRowId: (r) => r.id });
    service.columns.set([{ field: 'label', filter: 'text' }]);
  });

  describe('client row model', () => {
    it('accepts a plain array', () => {
      service.setRowData([{ id: 1, label: 'a' }]);
      expect(service.processedRows()).toHaveLength(1);
      expect(service.processedRows()[0].id).toBe(1);
    });

    it('accepts an Observable<T[]>', () => {
      const subject = new Subject<Item[]>();
      service.setRowData(subject);
      subject.next([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]);
      expect(service.processedRows()).toHaveLength(2);
    });

    it('runs the filter pipeline over processed rows', () => {
      service.setRowData([{ id: 1, label: 'apple' }, { id: 2, label: 'pear' }]);
      sortFilter.setColumnFilter('label', {
        filterType: 'text',
        join: 'and',
        conditions: [{ operator: 'contains', value: 'app' }],
      });
      expect(service.processedRows()).toHaveLength(1);
      expect(service.processedRows()[0].data.label).toBe('apple');
    });
  });

  describe('transactions + undo/redo', () => {
    beforeEach(() => service.setRowData([{ id: 1, label: 'a' }, { id: 2, label: 'b' }]));

    it('applies add/update/remove', () => {
      const result = service.applyTransaction({
        add: [{ id: 3, label: 'c' }],
        update: [{ id: 1, label: 'a2' }],
        remove: [{ id: 2, label: 'b' }],
      });
      expect(result.added).toHaveLength(1);
      expect(result.updated).toHaveLength(1);
      expect(result.removed).toHaveLength(1);
      expect(service.rawRows().map((r) => r.label).sort()).toEqual(['a2', 'c']);
    });

    it('undo reverses the last transaction; redo replays it', () => {
      service.applyTransaction({ remove: [{ id: 1, label: 'a' }] });
      expect(service.rawRows()).toHaveLength(1);
      expect(service.canUndo()).toBe(true);

      service.undo();
      expect(service.rawRows()).toHaveLength(2);
      expect(service.canRedo()).toBe(true);

      service.redo();
      expect(service.rawRows()).toHaveLength(1);
    });

    it('records changed cells for flashing on update', () => {
      service.applyTransaction({ update: [{ id: 1, label: 'changed' }] });
      expect(service.lastChangedCells().has('1|label')).toBe(true);
    });
  });

  describe('immutable mode', () => {
    it('keeps RowNode identity for untouched rows', () => {
      service.configure({ getRowId: (r) => r.id, immutableData: true });
      const a = { id: 1, label: 'a' };
      const b = { id: 2, label: 'b' };
      service.setRowData([a, b]);
      const before = service.processedRows();
      service.setRowData([a, { id: 2, label: 'b2' }]);
      const after = service.processedRows();
      expect(after[0]).toBe(before[0]); // same reference — skipped re-render
      expect(after[1]).not.toBe(before[1]);
    });
  });

  describe('server row model', () => {
    it('loads blocks lazily and reports the known total', async () => {
      const calls: GetRowsParams[] = [];
      service.configure({
        rowModelType: 'server',
        getRowId: (r) => r.id,
        cacheBlockSize: 2,
        datasource: {
          getRows: (params): Promise<GetRowsResult<Item>> => {
            calls.push(params);
            const rows = [
              { id: params.startRow, label: `row${params.startRow}` },
              { id: params.startRow + 1, label: `row${params.startRow + 1}` },
            ];
            return Promise.resolve({ rows, totalRowCount: 10 });
          },
        },
      });
      service.ensureRange(0, 2);
      await Promise.resolve(); // flush the datasource promise
      await Promise.resolve();
      expect(calls).toHaveLength(1);
      expect(service.totalRowCount()).toBe(10);
      expect(service.processedRows()[0].data.label).toBe('row0');
      // Unloaded rows materialize as loading placeholders.
      expect(service.isLoadingNode(service.processedRows()[5])).toBe(true);
    });

    it.todo('evicts least-recently-used blocks beyond maxBlocksInCache');
    it.todo('infinite model marks the dataset exhausted on a short block');
  });

  it.todo('pins rows top/bottom without duplicating them in the body');
  it.todo('tree data lazy-loads children on first expand');
});
