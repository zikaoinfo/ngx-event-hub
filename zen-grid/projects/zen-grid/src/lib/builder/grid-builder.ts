/**
 * Fluent, fully-typed grid configuration builder:
 *
 * ```ts
 * const config = GridBuilder.forType<Trade>()
 *   .withColumns(
 *     col<Trade, string>({ field: 'ticker', pinned: 'left' }),
 *     currencyColumn<Trade>('price'),
 *   )
 *   .withOptions({ immutableData: true })
 *   .withSelection({ mode: 'multiple', checkboxes: true })
 *   .build();
 * ```
 */
import { ColDefOrGroup, ColumnDef } from '../types/column-def.types';
import {
  GridOptions,
  GroupingOptions,
  SelectionOptions,
  StatePersistenceOptions,
  TreeDataOptions,
  ZenDatasource,
} from '../types/grid-options.types';
import { GetRowIdFn } from '../types/row-node.types';

export interface GridConfig<T extends object> {
  columnDefs: readonly ColDefOrGroup<T>[];
  options: GridOptions<T>;
}

export class GridBuilder<T extends object> {
  private columns: ColDefOrGroup<T>[] = [];
  private options: GridOptions<T> = {};

  private constructor() {}

  /** Entry point — pins T for every subsequent call. */
  static forType<T extends object>(): GridBuilder<T> {
    return new GridBuilder<T>();
  }

  withColumns(...defs: readonly ColDefOrGroup<T>[]): this {
    this.columns.push(...defs);
    return this;
  }

  withColumnGroup(groupId: string, headerName: string, ...children: readonly ColDefOrGroup<T>[]): this {
    this.columns.push({ groupId, headerName, children, isGroup: true });
    return this;
  }

  withOptions(options: Partial<GridOptions<T>>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  withDefaultColDef(defaults: Partial<ColumnDef<T>>): this {
    this.options = { ...this.options, defaultColDef: { ...this.options.defaultColDef, ...defaults } };
    return this;
  }

  withRowId(getRowId: GetRowIdFn<T>): this {
    this.options = { ...this.options, getRowId };
    return this;
  }

  withSelection(selection: SelectionOptions): this {
    this.options = { ...this.options, selection };
    return this;
  }

  withGrouping(grouping: GroupingOptions): this {
    this.options = { ...this.options, grouping };
    return this;
  }

  withTreeData(treeData: TreeDataOptions<T>): this {
    this.options = { ...this.options, treeData };
    return this;
  }

  withServerSideDatasource(datasource: ZenDatasource<T>, blockSize = 100): this {
    this.options = { ...this.options, rowModelType: 'server', datasource, cacheBlockSize: blockSize };
    return this;
  }

  withInfiniteScroll(datasource: ZenDatasource<T>, blockSize = 100): this {
    this.options = { ...this.options, rowModelType: 'infinite', datasource, cacheBlockSize: blockSize };
    return this;
  }

  withStatePersistence(persistence: StatePersistenceOptions): this {
    this.options = { ...this.options, statePersistence: persistence };
    return this;
  }

  build(): GridConfig<T> {
    if (this.columns.length === 0) {
      throw new Error('[ZenGrid] GridBuilder.build() called with no columns. Add .withColumns(...) first.');
    }
    return { columnDefs: this.columns, options: this.options };
  }
}
