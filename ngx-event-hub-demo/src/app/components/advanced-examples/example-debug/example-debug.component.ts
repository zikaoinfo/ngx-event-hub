import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-debug',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <button 
          (click)="enableDebug()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Enable Debug
        </button>
        <button 
          (click)="inspect()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Inspect Events
        </button>
        <button 
          (click)="sendEvent()"
          style="padding: 8px 16px; background: var(--success); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Event
        </button>
      </div>
      <div style="padding: 12px; background: white; border-radius: 4px; font-size: 13px;">
        <div style="margin-bottom: 8px;">
          <strong>Registered events:</strong> {{ registered.length > 0 ? registered.join(', ') : '(none)' }}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Listener count (inspect-demo):</strong> {{ listenerCount }}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Last value:</strong> {{ lastValue !== null ? JSON.stringify(lastValue) : '(none)' }}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Previous value:</strong> {{ previousValue !== null ? JSON.stringify(previousValue) : '(none)' }}
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px;">
          💡 Check console for debug logs when enabled
        </div>
      </div>
    </div>
  `
})
export class ExampleDebugComponent implements OnInit {
  registered: string[] = [];
  listenerCount: number = 0;
  lastValue: any = null;
  previousValue: any = null;
  JSON = JSON; // Expose JSON for template

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('inspect-demo', (data: any) => {
      // Listener registered
    });
    this.eventHub.cast('inspect-demo', { test: 'initial data' });
  }

  enableDebug(): void {
    this.eventHub.setDebugMode(true);
    console.log('Debug mode enabled - check console for logs');
  }

  inspect(): void {
    this.registered = this.eventHub.getRegisteredEvents();
    this.listenerCount = this.eventHub.getListenerCount('inspect-demo');
    this.lastValue = this.eventHub.getLast('inspect-demo');
    this.previousValue = this.eventHub.getPrevious('inspect-demo');
  }

  sendEvent(): void {
    this.eventHub.cast('inspect-demo', { timestamp: Date.now(), data: 'test' });
  }
}

