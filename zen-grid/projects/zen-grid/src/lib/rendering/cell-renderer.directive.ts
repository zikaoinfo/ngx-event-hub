/**
 * Renders a cell either as:
 *  1. a dynamically created Angular component (ColumnDef.cellRenderer),
 *  2. an embedded template (ColumnDef.cellRendererTemplate), or
 *  3. plain formatted text.
 *
 * Components are created in the host injector (the grid's DI scope), so
 * custom renderers can `inject()` grid services or app services freely.
 * On refresh, components implementing `zenRefresh` are updated in place;
 * otherwise they are destroyed and recreated.
 */
import {
  ComponentRef,
  Directive,
  EmbeddedViewRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import {
  CellRendererParams,
  CellTemplateContext,
  ColumnDef,
  ZenCellRenderer,
} from '../types/column-def.types';
import { GridApiService } from '../core/grid-api.service';
import { SortFilterEngine } from '../core/sort-filter.engine';

@Directive({
  selector: '[zenCellRenderer]',
  standalone: true,
})
export class CellRendererDirective<T extends object = object> {
  private readonly vcr = inject(ViewContainerRef);
  private readonly api = inject(GridApiService<T>);
  private readonly sortFilter = inject(SortFilterEngine<T>);

  readonly colDef = input.required<ColumnDef<T>>({ alias: 'zenCellRenderer' });
  readonly row = input.required<T>({ alias: 'zenCellRendererRow' });
  readonly rowIndex = input.required<number>({ alias: 'zenCellRendererRowIndex' });

  private componentRef: ComponentRef<ZenCellRenderer<T>> | null = null;
  private templateView: EmbeddedViewRef<CellTemplateContext<T>> | null = null;
  private textNode: Text | null = null;
  /** The renderer type currently instantiated — recreate when it changes. */
  private renderedWith: unknown = null;

  constructor() {
    effect(() => {
      const colDef = this.colDef();
      const row = this.row();
      const rowIndex = this.rowIndex();
      this.render(colDef, row, rowIndex);
    });
  }

  private render(colDef: ColumnDef<T>, row: T, rowIndex: number): void {
    const params = this.buildParams(colDef, row, rowIndex);

    if (colDef.cellRenderer) {
      if (this.componentRef && this.renderedWith === colDef.cellRenderer) {
        const instance = this.componentRef.instance;
        const kept = instance.zenRefresh?.(params) ?? false;
        if (kept) {
          this.componentRef.changeDetectorRef.markForCheck();
          return;
        }
      }
      this.clear();
      this.renderedWith = colDef.cellRenderer;
      this.componentRef = this.vcr.createComponent(colDef.cellRenderer);
      this.componentRef.instance.zenInit(params);
      this.componentRef.changeDetectorRef.markForCheck();
      return;
    }

    if (colDef.cellRendererTemplate) {
      const context: CellTemplateContext<T> = {
        $implicit: params.value,
        row,
        rowIndex,
        colDef,
      };
      if (this.templateView && this.renderedWith === colDef.cellRendererTemplate) {
        Object.assign(this.templateView.context, context);
        this.templateView.markForCheck();
        return;
      }
      this.clear();
      this.renderedWith = colDef.cellRendererTemplate;
      this.templateView = this.vcr.createEmbeddedView(colDef.cellRendererTemplate, context);
      return;
    }

    // Plain text path — a single Text node, mutated in place (no re-create).
    const text = params.valueFormatted;
    if (this.textNode) {
      if (this.textNode.data !== text) this.textNode.data = text;
      return;
    }
    this.clear();
    this.renderedWith = null;
    const hostEl = this.vcr.element.nativeElement as HTMLElement;
    const node = hostEl.ownerDocument.createTextNode(text);
    this.textNode = node;
    hostEl.appendChild(node);
  }

  private buildParams(colDef: ColumnDef<T>, row: T, rowIndex: number): CellRendererParams<T> {
    const value = this.sortFilter.valueOf(row, colDef);
    return {
      value,
      valueFormatted: this.sortFilter.displayValue(row, colDef),
      row,
      rowIndex,
      colDef,
      api: this.api,
    };
  }

  private clear(): void {
    this.componentRef?.destroy();
    this.componentRef = null;
    this.templateView?.destroy();
    this.templateView = null;
    this.textNode?.remove();
    this.textNode = null;
    this.vcr.clear();
  }
}
