/**
 * Example 2 — Server-side row model with Angular HttpClient.
 *
 * The grid emits sort/filter/pagination params through the ZenDatasource
 * contract; blocks are cached (LRU) and refetched when models change.
 */
import { Component, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ZenGridComponent,
  ColDefOrGroup,
  GetRowsParams,
  GetRowsResult,
  GridOptions,
  ZenDatasource,
  textColumn,
  numberColumn,
} from 'zen-grid';

interface Order {
  orderId: string;
  customer: string;
  status: string;
  total: number;
}

interface OrdersPage {
  items: Order[];
  totalCount: number;
}

class OrdersDatasource implements ZenDatasource<Order> {
  constructor(private readonly http: HttpClient) {}

  getRows(params: GetRowsParams): Observable<GetRowsResult<Order>> {
    let httpParams = new HttpParams()
      .set('offset', params.startRow)
      .set('limit', params.endRow - params.startRow);

    // Sort passthrough: ?sort=customer:asc,total:desc
    if (params.sortModel.length > 0) {
      httpParams = httpParams.set(
        'sort',
        params.sortModel.map((s) => `${s.colId}:${s.direction}`).join(','),
      );
    }
    // Filter passthrough: the server receives the JSON filter model verbatim.
    if (Object.keys(params.filterModel).length > 0) {
      httpParams = httpParams.set('filter', JSON.stringify(params.filterModel));
    }
    if (params.quickFilter) {
      httpParams = httpParams.set('q', params.quickFilter);
    }

    return this.http
      .get<OrdersPage>('/api/orders', { params: httpParams })
      .pipe(map((page) => ({ rows: page.items, totalRowCount: page.totalCount })));
  }
}

@Component({
  selector: 'app-server-side-grid',
  standalone: true,
  imports: [ZenGridComponent],
  template: `
    <zen-grid style="height: 560px" [columnDefs]="columnDefs" [options]="options" />
  `,
})
export class ServerSideGridComponent {
  private readonly http = inject(HttpClient);

  readonly columnDefs: ColDefOrGroup<Order>[] = [
    textColumn<Order>('orderId', { width: 130 }),
    textColumn<Order>('customer'),
    textColumn<Order>('status', { filter: 'set' }),
    numberColumn<Order>('total', { decimals: 2 }),
  ];

  readonly options: GridOptions<Order> = {
    rowModelType: 'server', // use 'infinite' for append-on-scroll instead
    datasource: new OrdersDatasource(this.http),
    getRowId: (o) => o.orderId,
    cacheBlockSize: 100,
    maxBlocksInCache: 10,
  };
}
