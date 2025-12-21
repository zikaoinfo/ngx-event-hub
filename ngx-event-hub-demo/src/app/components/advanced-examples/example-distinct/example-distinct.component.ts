import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-distinct',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <button 
          (click)="send('A')"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send 'A'
        </button>
        <button 
          (click)="send('B')"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send 'B'
        </button>
        <button 
          (click)="send('A')"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send 'A' again
        </button>
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Processed:</strong> {{ processed }}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Last value:</strong> {{ lastValue || '(none)' }}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        ✅ Only fires when value changes (duplicates are skipped)
      </div>
    </div>
  `
})
export class ExampleDistinctComponent implements OnInit {
  processed: number = 0;
  lastValue: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('distinct-demo', (data: any) => {
      this.processed++;
      this.lastValue = data;
    }, { distinct: true });
  }

  send(value: string): void {
    this.eventHub.cast('distinct-demo', value);
  }
}

