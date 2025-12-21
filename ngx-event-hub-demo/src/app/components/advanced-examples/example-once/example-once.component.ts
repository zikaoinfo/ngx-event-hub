import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-once',
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
          (click)="subscribeOnce()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Subscribe Once
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Triggered:</strong> {{ triggered }} time(s)
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Received:</strong> {{ message || '(none)' }}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        💡 Listener auto-removes after first trigger. Try sending multiple events!
      </div>
    </div>
  `
})
export class ExampleOnceComponent {
  message: string = '';
  triggered: number = 0;

  constructor(private eventHub: NgxEventHubService) {}

  subscribeOnce(): void {
    this.message = '';
    this.triggered = 0;
    this.eventHub.once('once-demo', (data: any) => {
      this.message = data;
      this.triggered++;
    });
  }

  sendEvent(): void {
    this.eventHub.cast('once-demo', `Event #${Date.now()}`);
  }
}

