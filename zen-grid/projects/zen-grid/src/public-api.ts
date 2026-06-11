/*
 * Public API surface of zen-grid.
 */

// Component + rendering
export { ZenGridComponent, CellEditorHostDirective, FilterHostDirective } from './lib/components/zen-grid.component';
export { CellRendererDirective } from './lib/rendering/cell-renderer.directive';

// Public API service
export { GridApiService } from './lib/core/grid-api.service';
export type { GridApi, GridUiHooks } from './lib/core/grid-api.service';

// Engines & managers (advanced usage / custom integrations)
export { VirtualScrollEngine } from './lib/core/virtual-scroll.engine';
export type { IndexRange } from './lib/core/virtual-scroll.engine';
export { DataSourceService } from './lib/core/data-source.service';
export { SortFilterEngine, defaultComparator, evaluateCondition, formatDefault } from './lib/core/sort-filter.engine';
export { SelectionManager } from './lib/core/selection.manager';
export { ColumnStateManager } from './lib/core/column-state.manager';
export type { ColumnState, HeaderCell } from './lib/core/column-state.manager';
export { CanvasRendererEngine } from './lib/core/canvas-renderer.engine';
export type { CanvasTheme } from './lib/core/canvas-renderer.engine';
export { aggregate, groupAndFlatten, pivot, resolveAggFunc, flattenTree } from './lib/core/aggregation.engine';
export type { PivotResult } from './lib/core/aggregation.engine';

// Export
export { ExportService, ZEN_EXCEL_ADAPTER, ZEN_PDF_ADAPTER } from './lib/export/export.service';
export type { CsvExportOptions, ExportSheet, ZenExcelAdapter, ZenPdfAdapter } from './lib/export/export.service';

// Theming
export { ThemeService } from './lib/theming/theme.service';
export type { ZenTheme, DarkModeSetting, ZenIconProvider, ZenIconName } from './lib/theming/theme.service';

// Builder + presets
export { GridBuilder } from './lib/builder/grid-builder';
export type { GridConfig } from './lib/builder/grid-builder';
export {
  badgeColumn,
  booleanColumn,
  currencyColumn,
  dateColumn,
  numberColumn,
  percentColumn,
  textColumn,
} from './lib/builder/column-presets';

// Types — columns
export { col, colIdOf, defaultHeaderName, getByPath, isColumnGroup, setByPath } from './lib/types/column-def.types';
export type {
  AggFunc,
  AggFuncSpec,
  BuiltInAggFunc,
  CellClassParams,
  CellEditorParams,
  CellRendererParams,
  CellTemplateContext,
  CellValidationResult,
  CellValidatorFn,
  ColDefOrGroup,
  ColumnDef,
  ColumnFilterModel,
  ColumnGroupDef,
  ColumnPinned,
  Comparator,
  DateFilterOperator,
  FieldPath,
  FieldPathValue,
  FilterComponentParams,
  FilterCondition,
  FilterModel,
  FilterOperator,
  FilterType,
  NumberFilterOperator,
  SortDirection,
  SortModelEntry,
  SpanParams,
  TextFilterOperator,
  TooltipComponentParams,
  ZenCellEditor,
  ZenCellRenderer,
  ZenFilterComponent,
  ZenTooltipComponent,
} from './lib/types/column-def.types';

// Types — rows
export type {
  CellPosition,
  CellRange,
  GetRowIdFn,
  RowId,
  RowNode,
  RowPinned,
  RowTransaction,
  RowTransactionResult,
} from './lib/types/row-node.types';

// Types — grid options & events
export type {
  CellClickedEvent,
  CellValueChangedEvent,
  ColumnEvent,
  ContextMenuItem,
  EditTrigger,
  FilterChangedEvent,
  GetRowsParams,
  GetRowsResult,
  GridOptions,
  GridReadyEvent,
  GroupingOptions,
  RowClickedEvent,
  RowDataInput,
  RowHeightStrategy,
  RowModelType,
  RowSelectionMode,
  SelectionChangedEvent,
  SelectionOptions,
  SortChangedEvent,
  StatePersistenceOptions,
  TreeDataOptions,
  ZenDatasource,
} from './lib/types/grid-options.types';
