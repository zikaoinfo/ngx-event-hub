import { TestBed } from '@angular/core/testing';
import { ExportService, ZEN_EXCEL_ADAPTER, ZenExcelAdapter, ExportSheet } from './export.service';
import { ColumnDef } from '../types/column-def.types';
import { RowNode } from '../types/row-node.types';

interface Item {
  name: string;
  price: number;
}

const node = (id: number, data: Item): RowNode<Item> => ({
  id,
  data,
  rowIndex: id,
  level: 0,
  pinned: null,
  isGroup: false,
  expanded: false,
});

const ROWS: RowNode<Item>[] = [
  node(0, { name: 'plain', price: 10 }),
  node(1, { name: 'has,comma', price: 20 }),
  node(2, { name: 'has "quote"', price: 30 }),
];

const COLUMNS: ColumnDef<Item>[] = [
  { field: 'name' },
  { field: 'price', valueFormatter: (v) => `$${v}` },
];

describe('ExportService', () => {
  let service: ExportService<Item>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ExportService] });
    service = TestBed.inject(ExportService<Item>);
  });

  it('produces CSV with a header row and CRLF line endings', () => {
    const csv = service.toCsv(ROWS, COLUMNS);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('Name,Price');
    expect(lines).toHaveLength(4);
  });

  it('escapes delimiters and quotes per RFC 4180', () => {
    const csv = service.toCsv(ROWS, COLUMNS);
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has ""quote"""');
  });

  it('applies valueFormatter (and exportFormatter overrides it)', () => {
    expect(service.toCsv(ROWS, COLUMNS)).toContain('$10');
    const cols: ColumnDef<Item>[] = [
      { field: 'price', valueFormatter: (v) => `$${v}`, exportFormatter: (v) => `${v}.00` },
    ];
    expect(service.toCsv(ROWS, cols)).toContain('10.00');
  });

  it('streams chunks of the configured size', () => {
    const many = Array.from({ length: 2500 }, (_, i) => node(i, { name: `n${i}`, price: i }));
    const chunks = [...service.csvChunks(many, COLUMNS, { chunkSize: 1000 })];
    expect(chunks.length).toBe(3); // 1000 + 1000 + 501 (incl. header)
  });

  it('skips group rows unless includeGroups is set', () => {
    const withGroup: RowNode<Item>[] = [
      { ...node(0, { name: 'x', price: 1 }), isGroup: true, groupKey: 'G', leafCount: 1 },
      node(1, { name: 'x', price: 1 }),
    ];
    expect(service.toCsv(withGroup, COLUMNS).trimEnd().split('\r\n')).toHaveLength(2);
    expect(service.toCsv(withGroup, COLUMNS, { includeGroups: true })).toContain('G (1)');
  });

  it('delegates Excel export to the registered adapter', async () => {
    const exported: ExportSheet[] = [];
    const adapter: ZenExcelAdapter = {
      exportExcel: async (_name, sheet) => {
        exported.push(sheet);
      },
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ExportService, { provide: ZEN_EXCEL_ADAPTER, useValue: adapter }],
    });
    const svc = TestBed.inject(ExportService<Item>);
    await svc.toExcel('test', ROWS, COLUMNS);
    expect(exported[0].header).toEqual(['Name', 'Price']);
    expect(exported[0].rows).toHaveLength(3);
  });

  it('throws a descriptive error when no adapter is registered', async () => {
    await expect(service.toExcel('x', ROWS, COLUMNS)).rejects.toThrow(/No Excel adapter/);
  });

  it.todo('downloadCsv prepends a UTF-8 BOM for Excel compatibility');
});
