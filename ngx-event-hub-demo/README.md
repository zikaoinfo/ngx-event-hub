
# NgxEventHubService

A lightweight Angular service for event handling within your application. The `NgxEventHubService` allows you to create and manage custom events efficiently using a simple `on` and `cast` API.

## Features

- Register custom events with a unique name.
- Broadcast (cast) events with optional data to listeners.
- Supports event unsubscription.

## Installation

Install the library using npm:

```bash
npm install ngx-event-hub
```

## Setup

1. Import the service in your Angular project.

   ```typescript
   import { NgxEventHubService } from 'ngx-event-hub';
   ```

2. Inject the service into your component or service where you want to use it.

   ```typescript
   import { Component, OnInit } from '@angular/core';
   import { NgxEventHubService } from 'ngx-event-hub';

   @Component({
     selector: 'app-sample',
     template: `<h1>Event Hub Demo</h1>`
   })
   export class SampleComponent implements OnInit {
     constructor(private eventHub: NgxEventHubService) {}

     ngOnInit(): void {
       // Register an event listener
       this.eventHub.on('myEvent', (data) => {
         console.log('Event received with data:', data);
       });
     }

     triggerEvent() {
       // Trigger the event and pass data to listeners
       this.eventHub.cast('myEvent', { key: 'value' });
     }
   }
   ```

## Usage

### Register an Event Listener

To listen for events, use the `on` method. This method takes two arguments:

- `eventName` - The name of the event to listen for.
- `callbackFn` - A function to execute when the event is triggered.

```typescript
this.eventHub.on('eventName', (data) => {
  console.log('Event data:', data);
});
```

### Trigger an Event

To trigger an event and optionally send data to listeners, use the `cast` method:

```typescript
this.eventHub.cast('eventName', { yourData: 'example' });
```

### Example

Here's a complete example of using `NgxEventHubService`:

```typescript
import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-root',
  template: `<button (click)="sendEvent()">Send Event</button>`,
})
export class AppComponent {
  constructor(private eventHub: NgxEventHubService) {
    this.eventHub.on('customEvent', (data) => {
      console.log('Received customEvent with data:', data);
    });
  }

  sendEvent() {
    this.eventHub.cast('customEvent', { message: 'Hello from NgxEventHubService!' });
  }
}
```

## License

This project is licensed under the MIT License.
