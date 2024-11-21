import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NgxEventHubService {
  eventsMap: Map<string, [(data?: any, previousData?: any) => void]> =
    new Map();
  previousData: any = undefined;
  constructor() {}
  on(eventName: string, callbackFn: (data?: any, previousData?: any) => void) {
    let calbbacksForEvent = this.eventsMap.get(eventName);
    if (calbbacksForEvent) {
      calbbacksForEvent.push(callbackFn);
    } else {
      calbbacksForEvent = [callbackFn];
      this.eventsMap.set(eventName, calbbacksForEvent);
    }
  }

  cast(eventName: string, data?: any | undefined) {
    let callbacks = this.eventsMap.get(eventName) || [];
    for (let callback of callbacks) {
      callback?.(data, this.previousData);
    }
    this.previousData = data;
  }
}
