# NgxEventHub

⚡ A lightweight, zero-dependency Angular service for event-driven communication between components. No RxJS required!

## 🌟 Features

- ✅ **Simple API**: `on()` and `cast()` methods for event handling
- ✅ **Auto-cleanup**: Unsubscribe functions and DestroyRef integration
- ✅ **Performance**: Built-in throttle, debounce, and distinct options
- ✅ **Memory Safe**: Per-event data isolation and proper cleanup
- ✅ **Type Safe**: Full TypeScript support
- ✅ **Scoped Hubs**: Create isolated event hubs for features/modules
- ✅ **Debug Mode**: Built-in debugging and inspection tools
- ✅ **Zero Dependencies**: No RxJS or other third-party libraries

## 📦 Installation

```bash
npm install ngx-event-hub
```

## 🚀 Quick Start

```typescript
import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  template: `
    <button (click)="sendEvent()">Send Event</button>
    <div>Received: {{ message }}</div>
  `
})
export class ExampleComponent implements OnInit {
  message: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    // Listen for events
    this.eventHub.on('myEvent', (data) => {
      this.message = data;
    });
  }

  sendEvent(): void {
    // Broadcast event to all listeners
    this.eventHub.cast('myEvent', 'Hello from NgxEventHub!');
  }
}
```

## 📖 Basic Usage

### Listening to Events

```typescript
this.eventHub.on('eventName', (data, previousData) => {
  console.log('Event data:', data);
  console.log('Previous data:', previousData);
});
```

### Broadcasting Events

```typescript
this.eventHub.cast('eventName', { key: 'value' });
```

### Unsubscribing

The `on()` method returns an unsubscribe function:

```typescript
const unsubscribe = this.eventHub.on('eventName', (data) => {
  // handler
});

// Later, when you want to remove the listener
unsubscribe();
```

Or use the `off()` method:

```typescript
const handler = (data: any) => {
  console.log(data);
};

this.eventHub.on('eventName', handler);
// Later...
this.eventHub.off('eventName', handler);
```

## 🎯 Advanced Features

### Auto-unsubscribe with DestroyRef (Angular 16+)

```typescript
import { Component, OnInit, DestroyRef, inject } from '@angular/core';

export class MyComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    // Automatically unsubscribes when component is destroyed
    this.eventHub.on('myEvent', (data) => {
      // handler
    }, { destroyRef: this.destroyRef });
  }
}
```

### Replay Last Value

New listeners can receive the last emitted value immediately:

```typescript
// Emit an event first
this.eventHub.cast('userLoaded', { id: 123, name: 'John' });

// Later, subscribe with replay - receives last value immediately
this.eventHub.on('userLoaded', (user) => {
  console.log(user); // { id: 123, name: 'John' }
}, { replayLast: true });
```

### Once Listener

Listeners that automatically remove themselves after first trigger:

```typescript
this.eventHub.once('initComplete', () => {
  console.log('Initialized!');
  // Listener is automatically removed after this runs
});
```

### Throttle

Limit callback execution frequency:

```typescript
// Max 1 call per 500ms
this.eventHub.on('scroll', (data) => {
  // Handle scroll
}, { throttle: 500 });
```

### Debounce

Delay callback until events stop firing:

```typescript
// Only fires after 300ms of no events
this.eventHub.on('input', (value) => {
  // Handle input
}, { debounce: 300 });
```

### Distinct Values

Skip callback when value hasn't changed:

```typescript
this.eventHub.on('statusChange', (status) => {
  // Only fires when status actually changes
}, { distinct: true });

// Custom comparison function
this.eventHub.on('statusChange', (status) => {
  // handler
}, { 
  distinct: true,
  compareFn: (current, previous) => current.id === previous.id 
});
```

### Scoped Hubs

Create isolated event hubs for different features:

```typescript
// Global hub
this.eventHub.on('cart:changed', handler);

// Scoped hub (isolated)
const checkoutHub = this.eventHub.createScope('checkout');
checkoutHub.on('cart:changed', handler); // Different listeners

// Events don't cross boundaries
this.eventHub.cast('cart:changed', data); // Only global listeners receive
checkoutHub.cast('cart:changed', data); // Only scoped listeners receive
```

### Async Emit

Emit events asynchronously using queueMicrotask:

```typescript
// Synchronous (default)
this.eventHub.cast('event', data);

// Asynchronous
this.eventHub.castAsync('event', data);
// Or
this.eventHub.cast('event', data, { async: true });
```

### Stop Propagation

Stop event from reaching other listeners:

```typescript
// Listener returns false to stop propagation
this.eventHub.on('event', () => {
  // Handle event
  return false; // Stops other listeners
});

this.eventHub.on('event', () => {
  // This won't be called if first listener returns false
});

// Cast with stopOnReturn option
this.eventHub.cast('event', data, { stopOnReturn: true });
```

### Error Handling

Isolate listener errors with custom error handlers:

```typescript
this.eventHub.on('event', (data) => {
  // May throw error
}, {
  onError: (error, eventName, data) => {
    console.error('Listener error:', error);
    // Error doesn't break other listeners
  }
});
```

### Debug Mode

Enable debug logging:

```typescript
// Enable debug mode
this.eventHub.setDebugMode(true);

// With custom logger
this.eventHub.setDebugMode(true, {
  log: (msg, ...args) => console.log('[DEBUG]', msg, ...args),
  warn: (msg, ...args) => console.warn('[WARN]', msg, ...args),
  error: (msg, ...args) => console.error('[ERROR]', msg, ...args)
});
```

### Inspection Helpers

```typescript
// Get all registered event names
const events = this.eventHub.getRegisteredEvents();

// Get listener count for an event
const count = this.eventHub.getListenerCount('eventName');

// Get last emitted data
const lastData = this.eventHub.getLast('eventName');

// Get previous data
const previousData = this.eventHub.getPrevious('eventName');

// Clear all listeners for an event
this.eventHub.clear('eventName');

// Clear all events
this.eventHub.clear();
```

## 📚 API Reference

### Methods

#### `on(eventName: string, callback: EventCallback, options?: ListenerOptions): () => void`

Register an event listener. Returns an unsubscribe function.

**Options:**
- `replayLast?: boolean` - Replay last value to new listeners
- `once?: boolean` - Auto-remove after first trigger
- `throttle?: number` - Throttle in milliseconds
- `debounce?: number` - Debounce in milliseconds
- `distinct?: boolean` - Skip when value hasn't changed
- `compareFn?: (current: any, previous: any) => boolean` - Custom comparison for distinct
- `destroyRef?: DestroyRef` - Auto-unsubscribe on component destroy
- `onError?: (error: Error, eventName: string, data?: any) => void` - Error handler

#### `off(eventName: string, callback: EventCallback): boolean`

Remove a specific listener. Returns `true` if removed.

#### `once(eventName: string, callback: EventCallback, options?: ListenerOptions): () => void`

Register a one-time listener. Returns unsubscribe function.

#### `cast(eventName: string, data?: any, options?: CastOptions): void`

Broadcast an event to all listeners.

**Options:**
- `async?: boolean` - Emit asynchronously
- `stopOnReturn?: boolean` - Stop propagation if listener returns false

#### `castAsync(eventName: string, data?: any, options?: CastOptions): void`

Convenience method for async casting.

#### `createScope(scopeName: string): NgxEventHubService`

Create a scoped, isolated event hub.

#### `setDebugMode(enabled: boolean, logger?: DebugLogger): void`

Enable/disable debug mode.

#### `getRegisteredEvents(): string[]`

Get all registered event names.

#### `getListenerCount(eventName: string): number`

Get listener count for an event.

#### `getLast(eventName: string): any`

Get last emitted data for an event.

#### `getPrevious(eventName: string): any`

Get previous data for an event.

#### `clear(eventName?: string): void`

Clear listeners for an event (or all events if no name provided).

## 🎮 Live Examples

Check out the interactive demo with all features:

🔗 **Live Demo**: [View Demo App](https://zikaoinfo.github.io/ngx-event-hub/)

The demo includes:
- Basic event communication
- Multiple receivers
- Real-time counter
- Activity tracker
- Code examples with HTML/TypeScript/Preview tabs
- Advanced features showcase

## 💡 Use Cases

- **Component Communication**: Decouple components without tight coupling
- **State Synchronization**: Keep multiple components in sync
- **Feature Modules**: Isolate events using scoped hubs
- **Performance**: Use throttle/debounce for high-frequency events
- **Debugging**: Enable debug mode to track event flow
- **Lazy Loading**: Use replayLast for late subscribers

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
