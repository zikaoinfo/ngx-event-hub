import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NgxEventHubService {
  eventsMap: Map<string,(data?: {}) => void> = new Map();
  constructor() { }
  on(eventName: string, callbackFn: (data?: {}) => void) {
    this.eventsMap.set(eventName, callbackFn);
  }
  

  cast(eventName: string, data?: {} | undefined) {
    this.eventsMap.get(eventName)?.(data)
  }
}
