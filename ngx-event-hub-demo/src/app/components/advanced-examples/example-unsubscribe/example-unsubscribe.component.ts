import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-unsubscribe',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <button 
          (click)="subscribe()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Subscribe
        </button>
        <button 
          (click)="unsubscribe()"
          [disabled]="!subscribed"
          style="padding: 8px 16px; background: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer; opacity: {{ subscribed ? 1 : 0.5 }};"
        >
          Unsubscribe
        </button>
        <button 
          (click)="sendEvent()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Event
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Status:</strong> {{ subscribed ? 'Subscribed' : 'Not subscribed' }}
      </div>
      <div>
        <strong>Received:</strong> {{ message || '(none)' }}
      </div>
    </div>
  `
})
export class ExampleUnsubscribeComponent {
  message: string = '';
  subscribed: boolean = false;
  private unsubscribeFn?: () => void;

  constructor(private eventHub: NgxEventHubService) {}

  subscribe(): void {
    if (!this.subscribed) {
      this.unsubscribeFn = this.eventHub.on('unsubscribe-demo', (data: any) => {
        this.message = data;
      });
      this.subscribed = true;
      this.message = '';
    }
  }

  unsubscribe(): void {
    if (this.subscribed && this.unsubscribeFn) {
      this.unsubscribeFn();
      this.subscribed = false;
      this.message = '';
    }
  }

  sendEvent(): void {
    this.eventHub.cast('unsubscribe-demo', `Event at ${new Date().toLocaleTimeString()}`);
  }
}

