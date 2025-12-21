import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-async',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <button 
          (click)="sendSync()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Sync Emit
        </button>
        <button 
          (click)="sendAsync()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Async Emit
        </button>
      </div>
      <div style="padding: 8px; background: white; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-line; min-height: 100px;">
        {{ order || '(click a button)' }}
      </div>
    </div>
  `
})
export class ExampleAsyncComponent implements OnInit {
  order: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('async-demo', () => {
      this.order += 'Event received\n';
    });
  }

  sendSync(): void {
    this.order = '';
    this.eventHub.cast('async-demo', 'sync');
    this.order += 'After cast\n';
  }

  sendAsync(): void {
    this.order = '';
    this.eventHub.castAsync('async-demo', 'async');
    this.order += 'After castAsync\n';
  }
}

