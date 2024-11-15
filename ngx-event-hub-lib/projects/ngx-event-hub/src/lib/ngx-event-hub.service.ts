import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NgxEventHubService {
  eventsMap: Map<string,[(data?: {}) => void]> = new Map();
  constructor() { }
  on(eventName: string, callbackFn: (data?: {}) => void) {
    let calbbacksForEvent = this.eventsMap.get(eventName)
    if(calbbacksForEvent) {
      calbbacksForEvent.push(callbackFn)
    } else {
      calbbacksForEvent = [callbackFn];
      this.eventsMap.set(eventName, calbbacksForEvent);
    }
  }
  

  cast(eventName: string, data?: {} | undefined) {
    let callbacks = this.eventsMap.get(eventName) || [];

    for(let callback of callbacks) {
      callback?.(data);
    }
  }
}
