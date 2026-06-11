# ZenGrid — Architecture

A production-grade, signal-native Angular 19+ data grid with zero external grid
dependencies. This document covers the module structure, the rendering pipeline,
the signal/state flow, and the key design decisions with rationale.

---

## 1. Module structure

```
zen-grid/                                  Angular CLI workspace (dev shell)
└── projects/zen-grid/                     ng-packagr library
    └── src/
        ├── public-api.ts                  Barrel export (tree-shake friendly)
        └── lib/
            ├── types/                     Pure types — zero runtime cost
            │   ├── column-def.types.ts    ColumnDef<T,V>, FieldPath<T>, renderer/editor contracts
            │   ├── grid-options.types.ts  GridOptions<T>, datasource contracts, events
            │   └── row-node.types.ts      RowNode<T>, transactions, group/tree nodes
            ├── core/                      Framework-agnostic engines + DI services
            │   ├── virtual-scroll.engine.ts   Row+column virtualization, offset cache
            │   ├── data-source.service.ts     Client/server/infinite row models, transactions, undo/redo
            │   ├── sort-filter.engine.ts      Multi-sort, 5 filter types, AND/OR trees, quick filter
            │   ├── aggregation.engine.ts      Group/aggregate/pivot, tree data
            │   ├── selection.manager.ts       Row + cell-range selection
            │   ├── column-state.manager.ts    Width/order/pin/visibility + persistence
            │   ├── canvas-renderer.engine.ts  Canvas paint path for 100k+ rows
            │   └── grid-api.service.ts        Public GridApi<T> facade
            ├── rendering/
            │   └── cell-renderer.directive.ts Dynamic component/template cell rendering
            ├── export/
            │   └── export.service.ts          Streaming CSV + pluggable XLSX/PDF adapters
            ├── theming/
            │   └── theme.service.ts           Token-based themes, dark mode
            ├── components/
            │   ├── zen-grid.component.ts      Entry component (standalone, OnPush, zoneless)
            │   ├── zen-grid.component.html
            │   └── zen-grid.component.scss    Design tokens + zen-arctic/slate/carbon themes
            └── builder/
                ├── grid-builder.ts            Fluent GridBuilder.forType<T>() API
                └── column-presets.ts          dateColumn(), currencyColumn(), badgeColumn()…
```

Feature isolation = tree-shakability: the export service, canvas engine,
aggregation engine, and builder are only pulled into a bundle when imported.
Nothing registers itself globally; everything is provided at the grid component
level (one DI scope **per grid instance**, so multiple grids never share state).

---

## 2. Rendering pipeline

```
                      ┌──────────────────────────────────────────────────────┐
 rowData input        │                    DATA PIPELINE                     │
 T[] | Signal<T[]>    │                                                      │
 | Observable<T[]> ──▶│ rawRows: signal<T[]>                                 │
                      │      │                                               │
 Transactions ───────▶│      ▼                                               │
 (add/update/remove,  │ filtered = computed(SortFilterEngine.filter)         │
  undo/redo stack)    │      ▼                                               │
                      │ sorted   = computed(SortFilterEngine.sort)           │
 filterModel signal ─▶│      ▼                                               │
 sortModel   signal ─▶│ grouped  = computed(AggregationEngine.group/pivot)   │
 groupModel  signal ─▶│      ▼                                               │
                      │ flattened: RowNode<T>[]  (groups expanded → flat)    │
                      └──────────────┬───────────────────────────────────────┘
                                     │ processedRows: Signal<RowNode<T>[]>
                                     ▼
                      ┌──────────────────────────────────────────────────────┐
 scrollTop  signal ──▶│                 VIRTUAL SCROLL ENGINE                │
 viewport h signal ──▶│ rowRange    = computed(binary-search offset cache)   │
 scrollLeft signal ──▶│ colRange    = computed(prefix-sum of col widths)     │
 col widths signal ──▶│ totalHeight = computed(Σ row heights)                │
                      └──────────────┬───────────────────────────────────────┘
                                     │ visibleSlots: Signal<RowSlot<T>[]>
                                     ▼
                ┌────────────────────┴─────────────────────┐
                ▼                                          ▼
   ┌─────────────────────────┐              ┌──────────────────────────────┐
   │  DOM PATH (default)     │              │  CANVAS PATH (100k+ rows)    │
   │  Recycled row pool:     │              │  Single <canvas>, rAF-batched│
   │  @for track slot.poolKey│              │  paint of visible range only │
   │  → element reuse, only  │              │  + DOM overlay for the focus │
   │  transform+bindings     │              │  /edit cell (a11y preserved) │
   │  change per frame       │              └──────────────────────────────┘
   │  pinned-left │ center   │
   │  (translate) │ (scroll) │ pinned-right
   └─────────────────────────┘
```

Scroll handling never triggers Angular change detection trees: the scroll
listener writes two signals (`scrollTop`, `scrollLeft`); every downstream value
is a `computed`. With OnPush + signals, only the bindings that actually changed
are re-evaluated — no layout thrashing, no zone.js.

## 3. Signal / state flow

| Store                | Owner                  | Key signals                                                        |
|----------------------|------------------------|--------------------------------------------------------------------|
| Data                 | `DataSourceService<T>` | `rawRows`, `processedRows`, `totalRowCount`, `loading`, `canUndo/Redo` |
| Columns              | `ColumnStateManager<T>`| `columnStates`, `visibleLeafColumns`, `leftPinned/center/rightPinned`, `headerRows` |
| Sort/Filter          | `SortFilterEngine<T>`  | `sortModel`, `filterModel`, `quickFilter`                          |
| Selection            | `SelectionManager<T>`  | `selectedIds`, `cellRanges`, `headerCheckboxState`                 |
| Viewport             | `VirtualScrollEngine`  | `scrollTop/Left`, `rowRange`, `colRange`, `totalHeight`            |
| Theme                | `ThemeService`         | `theme`, `darkMode`, `resolvedScheme`                              |
| Grid UI              | `ZenGridComponent<T>`  | `focusedCell`, `editingCell`, `hoveredRowIndex`                    |

Rules:

1. **Single writer** — each signal is written by exactly one owner; everyone
   else reads via `computed`. This makes state flow auditable and prevents
   feedback loops.
2. **Events are effects of state** — outputs (`sortChanged`, `selectionChanged`,
   …) are emitted at the mutation site, never from `effect()` watchers, so
   event order is deterministic.
3. **`GridApi<T>` is a facade** — it owns nothing; it delegates to the stores.
   That keeps the API surface stable while internals evolve.

## 4. Key design decisions

| Decision | Rationale |
|---|---|
| **Signals end-to-end, no zone.js** | Grids are scroll-hot. A signal write costs O(subscribers-of-that-signal); zone-based CD costs O(component tree). Zoneless also future-proofs for Angular's default. |
| **DOM recycling via `@for (track slot.poolKey)`** | `poolKey = rowIndex mod poolSize` keeps the *same DOM nodes* alive while their bindings retarget new rows during scroll. We get recycling from Angular's own differ instead of manual `appendChild` bookkeeping. |
| **Offset cache + binary search for row heights** | Fixed heights are O(1) math; dynamic/auto heights use a lazily-rebuilt prefix-sum array invalidated from the first dirty index — amortized O(log n) lookups, no full re-measure on edit. |
| **Canvas as an opt-in path, not the default** | Canvas wins above ~50k visible-area churn but loses native a11y/selection. We keep a one-cell DOM overlay (focus/editor) on top of the canvas so WCAG keyboard/AT support survives. |
| **Server row model = page cache keyed by block index** | The datasource contract (`getRows({startRow,endRow,sortModel,filterModel,…})`) is transport-agnostic (Promise or Observable). Sorting/filtering simply *invalidate the cache* and re-emit params — passthrough for free. |
| **Transactions produce their own inverse** | `applyTransaction` computes the inverse op while applying, pushing it on the undo stack. Undo/redo is then trivially `apply(inverse)` — no snapshotting of full datasets. |
| **Immutable mode = identity + getRowId reconciliation** | When `immutableData` is on, new arrays are diffed by row id; untouched `RowNode`s keep reference identity, so OnPush rows skip re-render and cell flash can detect *real* changes. |
| **Typed `FieldPath<T>` instead of magic strings** | `field: 'address.city'` autocompletes and type-errors at depth ≤ 4. `valueGetter` covers everything deeper or computed. |
| **Per-grid DI scope** | All stores are provided on `ZenGridComponent`, so `inject()` works naturally in custom renderers/editors/filters living inside the grid. |
| **SSR safety** | Every browser API (`ResizeObserver`, `requestAnimationFrame`, `navigator.clipboard`, `localStorage`, `matchMedia`, canvas) sits behind `isPlatformBrowser` guards (marked `// SSR-GUARD`). Server render emits the shell + first rows for SEO; hydration attaches without re-render. |
| **Pluggable export adapters** | CSV is dependency-free and streamed via a generator (constant memory). XLSX/PDF are interfaces (`ZenExcelAdapter`, `ZenPdfAdapter`) the app implements with the library of its choice — keeps ZenGrid at zero runtime deps. |
