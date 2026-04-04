import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeExampleComponent, CodeExample } from '../code-example/code-example.component';
import { ExampleUnsubscribeComponent } from './example-unsubscribe/example-unsubscribe.component';
import { ExampleDestroyRefComponent } from './example-destroy-ref/example-destroy-ref.component';
import { ExampleReplayComponent } from './example-replay/example-replay.component';
import { ExampleOnceComponent } from './example-once/example-once.component';
import { ExampleThrottleComponent } from './example-throttle/example-throttle.component';
import { ExampleDebounceComponent } from './example-debounce/example-debounce.component';
import { ExampleDistinctComponent } from './example-distinct/example-distinct.component';
import { ExampleScopeComponent } from './example-scope/example-scope.component';
import { ExampleStopPropagationComponent } from './example-stop-propagation/example-stop-propagation.component';
import { ExampleAsyncComponent } from './example-async/example-async.component';
import { ExampleDebugComponent } from './example-debug/example-debug.component';

@Component({
  selector: 'app-advanced-examples',
  standalone: true,
  imports: [CommonModule, CodeExampleComponent],
  templateUrl: './advanced-examples.component.html',
  styleUrl: './advanced-examples.component.css'
})
export class AdvancedExamplesComponent {
  examples: CodeExample[] = [
    {
      title: 'Unsubscribe Function',
      description: 'on() returns an unsubscribe function for easy cleanup',
      html: `<div>
  <button (click)="subscribe()">Subscribe</button>
  <button (click)="unsubscribe()" [disabled]="!subscribed">Unsubscribe</button>
  <div>Status: {{ status }}</div>
  <div>Received: {{ message }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  message: string = '';
  unsubscribe?: () => void;

  constructor(private eventHub: NgxEventHubService) {}

  subscribe(): void {
    // on() returns an unsubscribe function
    this.unsubscribe = this.eventHub.on('myEvent', (data) => {
      this.message = data;
    });
  }

  unsubscribe(): void {
    this.unsubscribe?.(); // Call to remove listener
  }
}`,
      previewComponent: ExampleUnsubscribeComponent
    },
    {
      title: 'DestroyRef Integration',
      description: 'Auto-unsubscribe when component is destroyed (Angular 16+)',
      html: `<div>
  <p>Listener automatically unsubscribes when component is destroyed</p>
  <div>Received: {{ message }}</div>
</div>`,
      ts: `import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent implements OnInit {
  message: string = '';
  private destroyRef = inject(DestroyRef);

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    // Auto-unsubscribes when component is destroyed
    this.eventHub.on('myEvent', (data) => {
      this.message = data;
    }, { destroyRef: this.destroyRef });
  }
}`,
      previewComponent: ExampleDestroyRefComponent
    },
    {
      title: 'Replay Last Value',
      description: 'New listeners receive the last emitted value immediately',
      html: `<div>
  <button (click)="send()">Send Event</button>
  <button (click)="subscribe()">Subscribe (with replay)</button>
  <div>Received: {{ message }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  message: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  send(): void {
    this.eventHub.cast('myEvent', 'Last value');
  }

  subscribe(): void {
    // Receives last emitted value immediately
    this.eventHub.on('myEvent', (data) => {
      this.message = data;
    }, { replayLast: true });
  }
}`,
      previewComponent: ExampleReplayComponent
    },
    {
      title: 'Once Listener',
      description: 'Listener automatically removes itself after first trigger',
      html: `<div>
  <button (click)="send()">Send Event</button>
  <button (click)="subscribeOnce()">Subscribe Once</button>
  <div>Received: {{ message }}</div>
  <div>Triggered: {{ triggered }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  message: string = '';
  triggered: number = 0;

  constructor(private eventHub: NgxEventHubService) {}

  subscribeOnce(): void {
    // Listener removes itself after first trigger
    this.eventHub.once('myEvent', (data) => {
      this.message = data;
      this.triggered++;
    });
  }

  send(): void {
    this.eventHub.cast('myEvent', 'Event data');
  }
}`,
      previewComponent: ExampleOnceComponent
    },
    {
      title: 'Throttle',
      description: 'Limit callback execution frequency',
      html: `<div>
  <button (click)="rapidFire()">Rapid Fire (10 events)</button>
  <div>Processed: {{ processed }}</div>
  <div>Last: {{ lastValue }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  processed: number = 0;
  lastValue: string = '';

  constructor(private eventHub: NgxEventHubService) {
    // Throttle to max 1 call per 500ms
    this.eventHub.on('rapidEvent', (data) => {
      this.processed++;
      this.lastValue = data;
    }, { throttle: 500 });
  }

  rapidFire(): void {
    for (let i = 0; i < 10; i++) {
      this.eventHub.cast('rapidEvent', \`Event \${i}\`);
    }
  }
}`,
      previewComponent: ExampleThrottleComponent
    },
    {
      title: 'Debounce',
      description: 'Delay callback until events stop firing',
      html: `<div>
  <input (input)="onInput($event)" placeholder="Type quickly...">
  <div>Debounced value: {{ debouncedValue }}</div>
  <div>Raw inputs: {{ inputCount }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  debouncedValue: string = '';
  inputCount: number = 0;

  constructor(private eventHub: NgxEventHubService) {
    // Only fires after 300ms of no events
    this.eventHub.on('inputEvent', (data) => {
      this.debouncedValue = data;
    }, { debounce: 300 });
  }

  onInput(event: Event): void {
    this.inputCount++;
    const value = (event.target as HTMLInputElement).value;
    this.eventHub.cast('inputEvent', value);
  }
}`,
      previewComponent: ExampleDebounceComponent
    },
    {
      title: 'Distinct Values',
      description: 'Skip callback when value hasn\'t changed',
      html: `<div>
  <button (click)="send('A')">Send 'A'</button>
  <button (click)="send('B')">Send 'B'</button>
  <button (click)="send('A')">Send 'A' again</button>
  <div>Processed: {{ processed }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  processed: number = 0;

  constructor(private eventHub: NgxEventHubService) {
    // Only fires when value changes
    this.eventHub.on('distinctEvent', (data) => {
      this.processed++;
    }, { distinct: true });
  }

  send(value: string): void {
    this.eventHub.cast('distinctEvent', value);
  }
}`,
      previewComponent: ExampleDistinctComponent
    },
    {
      title: 'Scoped Hubs',
      description: 'Create isolated event hubs for different features',
      html: `<div>
  <button (click)="sendGlobal()">Send Global</button>
  <button (click)="sendScoped()">Send Scoped</button>
  <div>Global received: {{ globalMsg }}</div>
  <div>Scoped received: {{ scopedMsg }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  globalMsg: string = '';
  scopedMsg: string = '';
  scopedHub: NgxEventHubService;

  constructor(private eventHub: NgxEventHubService) {
    // Global hub
    this.eventHub.on('myEvent', (data) => {
      this.globalMsg = data;
    });

    // Scoped hub (isolated)
    this.scopedHub = this.eventHub.createScope('feature');
    this.scopedHub.on('myEvent', (data) => {
      this.scopedMsg = data;
    });
  }

  sendGlobal(): void {
    this.eventHub.cast('myEvent', 'Global event');
  }

  sendScoped(): void {
    this.scopedHub.cast('myEvent', 'Scoped event');
  }
}`,
      previewComponent: ExampleScopeComponent
    },
    {
      title: 'Stop Propagation',
      description: 'Stop event from reaching other listeners',
      html: `<div>
  <button (click)="send()">Send Event</button>
  <div>Listener 1: {{ msg1 }}</div>
  <div>Listener 2: {{ msg2 }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  msg1: string = '';
  msg2: string = '';

  constructor(private eventHub: NgxEventHubService) {
    // First listener stops propagation
    this.eventHub.on('stopEvent', () => {
      this.msg1 = 'Received (stopped)';
      return false; // Stops propagation
    });

    // This won't be called if first returns false
    this.eventHub.on('stopEvent', () => {
      this.msg2 = 'This should not appear';
    });
  }

  send(): void {
    this.eventHub.cast('stopEvent', 'data', { stopOnReturn: true });
  }
}`,
      previewComponent: ExampleStopPropagationComponent
    },
    {
      title: 'Async Emit',
      description: 'Emit events asynchronously using queueMicrotask',
      html: `<div>
  <button (click)="sendSync()">Sync Emit</button>
  <button (click)="sendAsync()">Async Emit</button>
  <div>Order: {{ order }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  order: string = '';

  constructor(private eventHub: NgxEventHubService) {
    this.eventHub.on('asyncEvent', () => {
      this.order += 'Event received\\n';
    });
  }

  sendSync(): void {
    this.order = '';
    this.eventHub.cast('asyncEvent', 'sync');
    this.order += 'After cast\\n';
  }

  sendAsync(): void {
    this.order = '';
    this.eventHub.castAsync('asyncEvent', 'async');
    this.order += 'After castAsync\\n';
  }
}`,
      previewComponent: ExampleAsyncComponent
    },
    {
      title: 'Debug & Inspection',
      description: 'Debug mode and inspection helpers',
      html: `<div>
  <button (click)="enableDebug()">Enable Debug</button>
  <button (click)="inspect()">Inspect Events</button>
  <div>Registered: {{ registered.join(', ') }}</div>
  <div>Listeners: {{ listenerCount }}</div>
  <div>Last value: {{ lastValue }}</div>
</div>`,
      ts: `import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  template: \`<!-- template -->\`
})
export class ExampleComponent {
  registered: string[] = [];
  listenerCount: number = 0;
  lastValue: any = null;

  constructor(private eventHub: NgxEventHubService) {
    this.eventHub.on('inspectEvent', (data) => {
      // handler
    });
    this.eventHub.cast('inspectEvent', 'test data');
  }

  enableDebug(): void {
    this.eventHub.setDebugMode(true);
  }

  inspect(): void {
    this.registered = this.eventHub.getRegisteredEvents();
    this.listenerCount = this.eventHub.getListenerCount('inspectEvent');
    this.lastValue = this.eventHub.getLast('inspectEvent');
  }
}`,
      previewComponent: ExampleDebugComponent
    }
  ];
}

