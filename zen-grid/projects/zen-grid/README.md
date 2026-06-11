# ZenGrid

Production-grade, signal-native data grid for **Angular 19+**.
Zero runtime dependencies beyond Angular itself. Zoneless-compatible, SSR-safe,
tree-shakeable, fully typed (no `any`, no magic strings).

```bash
npm install zen-grid
```

```ts
import { ZenGridComponent, textColumn, currencyColumn } from 'zen-grid';

@Component({
  standalone: true,
  imports: [ZenGridComponent],
  template: `<zen-grid [rowData]="rows" [columnDefs]="cols" style="height: 400px" />`,
})
export class AppComponent {
  rows = [{ ticker: 'AAPL', price: 187.4 }];
  cols = [textColumn<Row>('ticker'), currencyColumn<Row>('price')];
}
```

## Highlights

- **Rendering** — row + column virtualization with DOM recycling, optional
  canvas paint path for 100k+ rows, pinned columns, fixed/dynamic/auto row heights
- **Data** — client, server-side (paged LRU block cache) and infinite-scroll
  row models; transactions with undo/redo; immutable-data reconciliation;
  `rowData` accepts `T[]`, `Signal<T[]>` or `Observable<T[]>`
- **Columns** — typed `ColumnDef<T>` with autocompleted dot-path fields,
  resize/reorder/pin/hide, multi-level header groups, JSON state persistence
- **Sort & filter** — multi-sort with priorities, text/number/date/set/boolean
  filters with AND/OR conditions, custom filter components, quick filter,
  server-side passthrough
- **Rows** — single/multi/checkbox/range selection, drag reorder, pinning,
  master-detail (nested grids), grouping with aggregation, tree data
- **Cells** — custom renderers/editors (Angular components), validation,
  flash-on-change, tooltips, context menu, cell ranges, clipboard
- **Aggregation & pivot** — sum/avg/min/max/count/first/last + custom functions,
  pivot column generation
- **Export** — streamed CSV built in; Excel/PDF via pluggable adapters
- **Theming** — design tokens, `zen-arctic` / `zen-slate` / `zen-carbon`,
  dark mode (auto + manual), swappable icon provider
- **A11y** — WCAG 2.1 AA: full keyboard nav, ARIA grid semantics, live
  announcements, focus management across virtual scroll

See [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for the rendering pipeline and
design decisions, and [`docs/examples`](../../docs/examples) for runnable
examples (basic, server-side, custom renderer, master-detail, pivot, export).

## License

MIT
