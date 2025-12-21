import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CodeExampleComponent, CodeExample } from '../code-example/code-example.component';
import { ExampleSenderComponent } from '../code-example/example-sender/example-sender.component';
import { ExampleReceiverComponent } from '../code-example/example-receiver/example-receiver.component';
import { ExampleSenderReceiverComponent } from '../code-example/example-sender-receiver/example-sender-receiver.component';

@Component({
  selector: 'app-code-examples',
  standalone: true,
  imports: [CommonModule, CodeExampleComponent],
  templateUrl: './code-examples.component.html',
  styleUrl: './code-examples.component.css'
})
export class CodeExamplesComponent {
  examples: CodeExample[] = [
    {
      title: 'Basic Event Listener',
      description: 'Listen for events and update component state',
      html: `<div>
  <h3>Received: {{ message }}</h3>
</div>`,
      ts: `import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-receiver',
  standalone: true,
  template: \`<div><h3>Received: {{ message }}</h3></div>\`
})
export class ReceiverComponent implements OnInit {
  message: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('myEvent', (data: any) => {
      this.message = data;
    });
  }
}`,
      previewComponent: ExampleReceiverComponent
    },
    {
      title: 'Complete Example: Sender & Receiver',
      description: 'A complete working example with both sender and receiver components',
      html: `<div>
  <!-- Sender Component -->
  <input [(ngModel)]="message" />
  <button (click)="send()">Send Event</button>

  <!-- Receiver Component -->
  <div>Received: {{ received }}</div>
</div>`,
      ts: `import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  standalone: true,
  imports: [FormsModule],
  template: \`<div>
    <input [(ngModel)]="message" />
    <button (click)="send()">Send Event</button>
    <div>Received: {{ received }}</div>
  </div>\`
})
export class ExampleComponent implements OnInit {
  message: string = '';
  received: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('myEvent', (data: any) => {
      this.received = data;
    });
  }

  send(): void {
    this.eventHub.cast('myEvent', this.message);
    this.message = '';
  }
}`,
      previewComponent: ExampleSenderReceiverComponent
    },
    {
      title: 'Sending Events',
      description: 'Broadcast events to all registered listeners',
      html: `<div>
  <input [(ngModel)]="message" placeholder="Enter message..." />
  <button (click)="sendEvent()">Send Event</button>
</div>`,
      ts: `import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-sender',
  standalone: true,
  imports: [FormsModule],
  template: \`<div>
    <input [(ngModel)]="message" placeholder="Enter message..." />
    <button (click)="sendEvent()">Send Event</button>
  </div>\`
})
export class SenderComponent {
  message: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  sendEvent(): void {
    this.eventHub.cast('myEvent', this.message);
    this.message = '';
  }
}`,
      previewComponent: ExampleSenderComponent
    },
    {
      title: 'Multiple Listeners',
      description: 'Multiple components can listen to the same event',
      html: `<!-- Component 1 -->
<div>Listener 1: {{ data1 }}</div>

<!-- Component 2 -->
<div>Listener 2: {{ data2 }}</div>`,
      ts: `// Both components listen to the same event
ngOnInit(): void {
  this.eventHub.on('sharedEvent', (data: any) => {
    // Component 1 updates data1
    // Component 2 updates data2
    this.data1 = data;
  });
}

// Sender broadcasts to all listeners
sendToAll(): void {
  this.eventHub.cast('sharedEvent', 'Broadcast message');
}`,
      previewComponent: ExampleReceiverComponent
    }
  ];
}

