import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-throttle',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="margin-bottom: 12px;">
        <button 
          (click)="rapidFire()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Rapid Fire (10 events)
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Processed:</strong> {{ processed }} / 10
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Last value:</strong> {{ lastValue || '(none)' }}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        ⏱️ Throttled to max 1 call per 500ms (should process ~2-3 out of 10)
      </div>
    </div>
  `
})
export class ExampleThrottleComponent implements OnInit {
  processed: number = 0;
  lastValue: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('throttle-demo', (data: any) => {
      this.processed++;
      this.lastValue = data;
    }, { throttle: 500 });
  }

  rapidFire(): void {
    this.processed = 0;
    this.lastValue = '';
    // Fire events rapidly
    for (let i = 0; i < 10; i++) {
      this.eventHub.cast('throttle-demo', `Event ${i + 1}`);
    }
  }
}

