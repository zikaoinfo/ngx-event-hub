import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-replay',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <button 
          (click)="sendEvent()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Event
        </button>
        <button 
          (click)="subscribe()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Subscribe (with replay)
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Status:</strong> {{ subscribed ? 'Subscribed (replay enabled)' : 'Not subscribed' }}
      </div>
      <div>
        <strong>Received:</strong> {{ message || '(none)' }}
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
        💡 Tip: Send an event first, then subscribe to see the last value immediately
      </div>
    </div>
  `
})
export class ExampleReplayComponent {
  message: string = '';
  subscribed: boolean = false;

  constructor(private eventHub: NgxEventHubService) {}

  sendEvent(): void {
    const value = `Last value: ${new Date().toLocaleTimeString()}`;
    this.eventHub.cast('replay-demo', value);
  }

  subscribe(): void {
    if (!this.subscribed) {
      this.eventHub.on('replay-demo', (data: any) => {
        this.message = data;
      }, { replayLast: true });
      this.subscribed = true;
    }
  }
}

