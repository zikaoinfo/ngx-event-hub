/**
 * Example 3 — Custom cell renderer component.
 *
 * Renderers are plain standalone components implementing ZenCellRenderer.
 * `zenRefresh` returning true lets the grid update the instance in place
 * (no destroy/recreate) when data changes — important for flash/animation.
 */
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  ZenGridComponent,
  ZenCellRenderer,
  CellRendererParams,
  ColDefOrGroup,
  col,
  textColumn,
} from 'zen-grid';

interface Server {
  host: string;
  cpuLoad: number; // 0..1
}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="load-bar" role="meter" [attr.aria-valuenow]="percent()">
      <div
        class="load-bar-fill"
        [style.width.%]="percent()"
        [style.background]="percent() > 80 ? '#dc2626' : percent() > 60 ? '#f59e0b' : '#16a34a'"
      ></div>
      <span class="load-bar-label">{{ percent() }}%</span>
    </div>
  `,
  styles: `
    .load-bar { position: relative; width: 100%; height: 16px; background: #e5e7eb; border-radius: 8px; overflow: hidden; }
    .load-bar-fill { height: 100%; transition: width 200ms ease; }
    .load-bar-label { position: absolute; inset: 0; text-align: center; font-size: 10px; line-height: 16px; }
  `,
})
export class CpuLoadRendererComponent implements ZenCellRenderer<Server, number> {
  readonly percent = signal(0);

  zenInit(params: CellRendererParams<Server, number>): void {
    this.percent.set(Math.round(params.value * 100));
  }

  zenRefresh(params: CellRendererParams<Server, number>): boolean {
    this.percent.set(Math.round(params.value * 100));
    return true; // instance reused — no DOM churn
  }
}

@Component({
  selector: 'app-renderer-grid',
  standalone: true,
  imports: [ZenGridComponent],
  template: `<zen-grid style="height: 400px" [rowData]="servers" [columnDefs]="columnDefs" />`,
})
export class RendererGridComponent {
  readonly servers: Server[] = [
    { host: 'web-01', cpuLoad: 0.42 },
    { host: 'web-02', cpuLoad: 0.87 },
    { host: 'db-01', cpuLoad: 0.65 },
  ];

  readonly columnDefs: ColDefOrGroup<Server>[] = [
    textColumn<Server>('host', { width: 140 }),
    col<Server, number>({
      field: 'cpuLoad',
      headerName: 'CPU Load',
      cellRenderer: CpuLoadRendererComponent,
      enableCellFlash: false, // renderer animates itself
      width: 220,
    }),
  ];
}
