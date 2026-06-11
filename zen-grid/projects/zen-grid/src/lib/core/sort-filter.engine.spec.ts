import { TestBed } from '@angular/core/testing';
import { ColumnDef } from '../types/column-def.types';
import { SortFilterEngine, defaultComparator, evaluateCondition } from './sort-filter.engine';

interface Person {
  name: string;
  age: number;
  active: boolean;
  joined: Date;
}

const PEOPLE: Person[] = [
  { name: 'Cara', age: 41, active: true, joined: new Date('2024-01-10') },
  { name: 'Abe', age: 29, active: false, joined: new Date('2023-06-01') },
  { name: 'Bo', age: 29, active: true, joined: new Date('2025-03-15') },
];

const COLUMNS: ColumnDef<Person>[] = [
  { field: 'name', filter: 'text' },
  { field: 'age', filter: 'number' },
  { field: 'active', filter: 'boolean' },
  { field: 'joined', filter: 'date' },
];

describe('SortFilterEngine', () => {
  let engine: SortFilterEngine<Person>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SortFilterEngine] });
    engine = TestBed.inject(SortFilterEngine<Person>);
  });

  describe('sorting', () => {
    it('sorts by a single column ascending', () => {
      const sorted = engine.sort(PEOPLE, [{ colId: 'name', direction: 'asc', priority: 0 }], COLUMNS);
      expect(sorted.map((p) => p.name)).toEqual(['Abe', 'Bo', 'Cara']);
    });

    it('applies multi-column sort in priority order', () => {
      const sorted = engine.sort(
        PEOPLE,
        [
          { colId: 'age', direction: 'asc', priority: 0 },
          { colId: 'name', direction: 'desc', priority: 1 },
        ],
        COLUMNS,
      );
      expect(sorted.map((p) => p.name)).toEqual(['Bo', 'Abe', 'Cara']);
    });

    it('toggleSort cycles asc → desc → none', () => {
      engine.toggleSort('age', false);
      expect(engine.sortModel()[0].direction).toBe('asc');
      engine.toggleSort('age', false);
      expect(engine.sortModel()[0].direction).toBe('desc');
      engine.toggleSort('age', false);
      expect(engine.sortModel()).toEqual([]);
    });

    it('shift-toggle appends to the multi-sort with increasing priority', () => {
      engine.toggleSort('age', false);
      engine.toggleSort('name', true);
      expect(engine.sortModel().map((s) => s.colId)).toEqual(['age', 'name']);
      expect(engine.sortModel()[1].priority).toBe(1);
    });

    it('respects custom comparators', () => {
      const cols: ColumnDef<Person>[] = [
        { field: 'name', comparator: (a, b) => String(a).length - String(b).length },
      ];
      const sorted = engine.sort(PEOPLE, [{ colId: 'name', direction: 'asc', priority: 0 }], cols);
      expect(sorted.map((p) => p.name)).toEqual(['Bo', 'Abe', 'Cara']);
    });
  });

  describe('filtering', () => {
    it('applies text contains', () => {
      const out = engine.filter(
        PEOPLE,
        { name: { filterType: 'text', join: 'and', conditions: [{ operator: 'contains', value: 'a' }] } },
        null,
        COLUMNS,
      );
      expect(out.map((p) => p.name)).toEqual(['Cara', 'Abe']);
    });

    it('combines conditions with OR', () => {
      const out = engine.filter(
        PEOPLE,
        {
          age: {
            filterType: 'number',
            join: 'or',
            conditions: [
              { operator: 'equals', value: 41 },
              { operator: 'lessThan', value: 30 },
            ],
          },
        },
        null,
        COLUMNS,
      );
      expect(out).toHaveLength(3);
    });

    it('applies the set filter', () => {
      const out = engine.filter(
        PEOPLE,
        { name: { filterType: 'set', join: 'and', conditions: [], setValues: ['Bo'] } },
        null,
        COLUMNS,
      );
      expect(out.map((p) => p.name)).toEqual(['Bo']);
    });

    it('quick filter searches across all columns', () => {
      const out = engine.filter(PEOPLE, {}, 'bo', COLUMNS);
      expect(out.map((p) => p.name)).toEqual(['Bo']);
    });

    it.todo('filters dates by inRange across day boundaries');
    it.todo('excludes columns with quickFilter:false from the quick filter');
  });

  describe('pure helpers', () => {
    it('defaultComparator handles null/undefined first', () => {
      expect(defaultComparator(null, 1)).toBeLessThan(0);
      expect(defaultComparator(2, undefined)).toBeGreaterThan(0);
    });

    it('evaluateCondition handles number inRange', () => {
      expect(evaluateCondition(5, { operator: 'inRange', value: 1, valueTo: 10 }, 'number')).toBe(true);
      expect(evaluateCondition(50, { operator: 'inRange', value: 1, valueTo: 10 }, 'number')).toBe(false);
    });
  });
});
