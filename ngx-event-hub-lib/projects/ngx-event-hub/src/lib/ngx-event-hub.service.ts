import { Injectable, Optional, Inject, DestroyRef } from '@angular/core';

// Types
export interface EventOptions {
  replayLast?: boolean;
  once?: boolean;
  stopOnReturn?: boolean;
  throttle?: number;
  debounce?: number;
  distinct?: boolean;
  compareFn?: (current: any, previous: any) => boolean;
  scope?: string;
  onError?: (error: Error, eventName: string, data?: any) => void;
}

export interface ListenerOptions extends EventOptions {
  destroyRef?: DestroyRef;
}

export interface CastOptions {
  async?: boolean;
  stopOnReturn?: boolean;
  scope?: string;
}

export type EventCallback = (data?: any, previousData?: any) => void | boolean;

export type EventMap = Record<string, any>;

// Debug interface
export interface DebugLogger {
  log?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

@Injectable({
  providedIn: 'root',
})
export class NgxEventHubService {
  // Core event storage
  private eventsMap: Map<string, Set<EventCallback>> = new Map();
  
  // Per-event previous data storage
  private previousDataMap: Map<string, any> = new Map();
  
  // Per-event last data storage (for replay)
  private lastDataMap: Map<string, any> = new Map();
  
  // Listener metadata for cleanup and options
  private listenerMetadata: Map<EventCallback, {
    eventName: string;
    options?: ListenerOptions;
    throttledFn?: () => void;
    debouncedFn?: () => void;
    lastCallTime?: number;
    pendingCall?: any;
  }> = new Map();
  
  // Scoping support
  private scope: string = 'default';
  private scopedHubs: Map<string, NgxEventHubService> = new Map();
  
  // Debug mode
  private debugMode: boolean = false;
  private debugLogger?: DebugLogger;
  
  // Strict mode for typed events
  private strictMode: boolean = false;
  private allowedEvents?: Set<string>;
  
  constructor(
    @Optional() @Inject('NGX_EVENT_HUB_DEBUG') debugConfig?: { enabled: boolean; logger?: DebugLogger },
    @Optional() @Inject('NGX_EVENT_HUB_SCOPE') scope?: string,
    @Optional() @Inject('NGX_EVENT_HUB_STRICT') strictConfig?: { enabled: boolean; events?: string[] }
  ) {
    if (scope) {
      this.scope = scope;
    }
    if (debugConfig?.enabled) {
      this.debugMode = true;
      this.debugLogger = debugConfig.logger || console;
    }
    if (strictConfig?.enabled) {
      this.strictMode = true;
      if (strictConfig.events) {
        this.allowedEvents = new Set(strictConfig.events);
      }
    }
  }

  /**
   * Register an event listener
   * @returns Unsubscribe function
   */
  on(eventName: string, callbackFn: EventCallback, options?: ListenerOptions): () => void {
    // Validate event name in strict mode
    if (this.strictMode && this.allowedEvents && !this.allowedEvents.has(eventName)) {
      const error = new Error(`Unknown event name: ${eventName}`);
      this.debugLog('warn', `Strict mode violation: ${error.message}`);
      if (options?.onError) {
        options.onError(error, eventName);
      }
      if (this.debugMode) {
        throw error;
      }
      return () => {}; // Return no-op unsubscribe
    }

    // Wrap callback with error handling
    const wrappedCallback: EventCallback = (data?: any, previousData?: any) => {
      try {
        const result = callbackFn(data, previousData);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.debugLog('error', `Listener error for event "${eventName}":`, err);
        if (options?.onError) {
          options.onError(err, eventName, data);
        }
        return false;
      }
    };

    // Store original callback for throttling/debouncing
    let finalCallback = wrappedCallback;
    
    // Handle distinct option - wrap callback to check for changes
    if (options?.distinct) {
      const compareFn = options.compareFn || ((a: any, b: any) => a === b);
      let lastReceivedData: any = undefined;
      const distinctCallback: EventCallback = (data?: any, previousData?: any) => {
        if (!compareFn(data, lastReceivedData)) {
          lastReceivedData = data;
          return wrappedCallback(data, previousData);
        }
        return false;
      };
      finalCallback = distinctCallback;
    }

    // Handle throttling
    if (options?.throttle && options.throttle > 0) {
      let lastCallTime = 0;
      const throttledWrapper: EventCallback = (data?: any, previousData?: any) => {
        const now = Date.now();
        if (now - lastCallTime >= options.throttle!) {
          lastCallTime = now;
          return finalCallback(data, previousData);
        }
        return false;
      };
      this.listenerMetadata.set(finalCallback, {
        eventName,
        options,
        lastCallTime: 0
      });
      finalCallback = throttledWrapper;
    }

    // Handle debouncing
    if (options?.debounce && options.debounce > 0) {
      let timeoutId: any;
      let pendingData: any;
      let pendingPrevious: any;
      const debouncedWrapper: EventCallback = (data?: any, previousData?: any) => {
        clearTimeout(timeoutId);
        pendingData = data;
        pendingPrevious = previousData;
        timeoutId = setTimeout(() => {
          finalCallback(pendingData, pendingPrevious);
        }, options.debounce!);
        return false;
      };
      this.listenerMetadata.set(finalCallback, {
        eventName,
        options,
        pendingCall: timeoutId
      });
      finalCallback = debouncedWrapper;
    }

    // Get or create callback set for this event
    let callbacks = this.eventsMap.get(eventName);
    if (!callbacks) {
      callbacks = new Set();
      this.eventsMap.set(eventName, callbacks);
    }

    // Add final callback (may be wrapped with throttling/debouncing/distinct)
    callbacks.add(finalCallback);
    const existingMetadata = this.listenerMetadata.get(finalCallback);
    this.listenerMetadata.set(finalCallback, {
      eventName,
      options,
      ...existingMetadata
    });

    // Handle replay last value
    if (options?.replayLast && this.lastDataMap.has(eventName)) {
      const lastData = this.lastDataMap.get(eventName);
      const previousData = this.previousDataMap.get(eventName);
      try {
        finalCallback(lastData, previousData);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (options?.onError) {
          options.onError(err, eventName, lastData);
        }
      }
    }

    // Handle DestroyRef integration
    if (options?.destroyRef) {
      options.destroyRef.onDestroy(() => {
        this.off(eventName, finalCallback);
      });
    }

    this.debugLog('log', `Listener registered for event "${eventName}"`);

    // Return unsubscribe function
    return () => {
      this.off(eventName, finalCallback);
    };
  }

  /**
   * Remove a specific listener
   */
  off(eventName: string, callbackFn: EventCallback): boolean {
    const callbacks = this.eventsMap.get(eventName);
    if (!callbacks) {
      return false;
    }

    const removed = callbacks.delete(callbackFn);
    if (removed) {
      // Cleanup metadata
      const metadata = this.listenerMetadata.get(callbackFn);
      if (metadata?.debouncedFn && metadata.pendingCall) {
        clearTimeout(metadata.pendingCall);
      }
      this.listenerMetadata.delete(callbackFn);
      
      // Clean up empty event entries
      if (callbacks.size === 0) {
        this.eventsMap.delete(eventName);
        this.previousDataMap.delete(eventName);
        this.lastDataMap.delete(eventName);
      }
      
      this.debugLog('log', `Listener removed for event "${eventName}"`);
    }
    
    return removed;
  }

  /**
   * Register a one-time listener
   */
  once(eventName: string, callbackFn: EventCallback, options?: Omit<ListenerOptions, 'once'>): () => void {
    let unsubscribed = false;
    const onceCallback: EventCallback = (data?: any, previousData?: any) => {
      if (!unsubscribed) {
        unsubscribed = true;
        this.off(eventName, onceCallback);
        return callbackFn(data, previousData);
      }
      return false;
    };
    return this.on(eventName, onceCallback, { ...options, once: true });
  }

  /**
   * Emit an event
   */
  cast(eventName: string, data?: any, options?: CastOptions): void {
    // Validate event name in strict mode
    if (this.strictMode && this.allowedEvents && !this.allowedEvents.has(eventName)) {
      const error = new Error(`Unknown event name: ${eventName}`);
      this.debugLog('warn', `Strict mode violation: ${error.message}`);
      throw error;
    }

    // Note: Global distinct checking is not implemented here
    // Per-listener distinct checking is handled when listeners are registered
    // This allows different listeners to have different distinct behaviors

    const emitFn = () => {
      const callbacks = this.eventsMap.get(eventName);
      if (!callbacks || callbacks.size === 0) {
        this.debugLog('log', `Event "${eventName}" cast but no listeners`);
        return;
      }

      const previousData = this.previousDataMap.get(eventName);

      // Update previous and last data
      this.previousDataMap.set(eventName, this.lastDataMap.get(eventName));
      this.lastDataMap.set(eventName, data);

      this.debugLog('log', `Event "${eventName}" cast to ${callbacks.size} listener(s)`, data);

      // Call all callbacks
      for (const callback of callbacks) {
        try {
          const result = callback(data, previousData);
          
          // Handle stop propagation
          if (options?.stopOnReturn && result === false) {
            this.debugLog('log', `Event "${eventName}" propagation stopped by listener`);
            break;
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.debugLog('error', `Error in listener for event "${eventName}":`, err);
        }
      }
    };

    // Handle async emit
    if (options?.async) {
      queueMicrotask(emitFn);
    } else {
      emitFn();
    }
  }

  /**
   * Async cast (convenience method)
   */
  castAsync(eventName: string, data?: any, options?: Omit<CastOptions, 'async'>): void {
    this.cast(eventName, data, { ...options, async: true });
  }

  /**
   * Create a scoped hub instance
   */
  createScope(scopeName: string): NgxEventHubService {
    if (this.scopedHubs.has(scopeName)) {
      return this.scopedHubs.get(scopeName)!;
    }
    
    const scopedHub = new NgxEventHubService(
      { enabled: this.debugMode, logger: this.debugLogger },
      scopeName,
      { enabled: this.strictMode, events: this.allowedEvents ? Array.from(this.allowedEvents) : undefined }
    );
    this.scopedHubs.set(scopeName, scopedHub);
    return scopedHub;
  }

  /**
   * Get list of registered event names
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.eventsMap.keys());
  }

  /**
   * Get listener count for an event
   */
  getListenerCount(eventName: string): number {
    return this.eventsMap.get(eventName)?.size || 0;
  }

  /**
   * Get last data for an event
   */
  getLast(eventName: string): any {
    return this.lastDataMap.get(eventName);
  }

  /**
   * Get previous data for an event
   */
  getPrevious(eventName: string): any {
    return this.previousDataMap.get(eventName);
  }

  /**
   * Clear all listeners for an event (or all events)
   */
  clear(eventName?: string): void {
    if (eventName) {
      const callbacks = this.eventsMap.get(eventName);
      if (callbacks) {
        callbacks.forEach(cb => {
          const metadata = this.listenerMetadata.get(cb);
          if (metadata?.debouncedFn && metadata.pendingCall) {
            clearTimeout(metadata.pendingCall);
          }
          this.listenerMetadata.delete(cb);
        });
      }
      this.eventsMap.delete(eventName);
      this.previousDataMap.delete(eventName);
      this.lastDataMap.delete(eventName);
      this.debugLog('log', `Cleared event "${eventName}"`);
    } else {
      // Clear all events
      this.eventsMap.forEach((callbacks, name) => {
        callbacks.forEach(cb => {
          const metadata = this.listenerMetadata.get(cb);
          if (metadata?.debouncedFn && metadata.pendingCall) {
            clearTimeout(metadata.pendingCall);
          }
        });
      });
      this.eventsMap.clear();
      this.previousDataMap.clear();
      this.lastDataMap.clear();
      this.listenerMetadata.clear();
      this.debugLog('log', 'Cleared all events');
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean, logger?: DebugLogger): void {
    this.debugMode = enabled;
    if (logger) {
      this.debugLogger = logger;
    }
  }

  /**
   * Internal debug logging
   */
  private debugLog(level: 'log' | 'warn' | 'error', message: string, ...args: any[]): void {
    if (this.debugMode && this.debugLogger) {
      const logger = this.debugLogger[level] || this.debugLogger.log || console.log;
      logger(`[NgxEventHub${this.scope !== 'default' ? `:${this.scope}` : ''}] ${message}`, ...args);
    }
  }
}
