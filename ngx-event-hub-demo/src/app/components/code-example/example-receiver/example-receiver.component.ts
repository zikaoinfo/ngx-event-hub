import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-receiver',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">
        Received Message:
      </div>
      <div [style.color]="data ? 'var(--primary)' : 'var(--text-secondary)'" style="font-size: 18px; min-height: 24px;">
        {{ data || 'Waiting for events...' }}
      </div>
    </div>
  `
})
export class ExampleReceiverComponent implements OnInit {
  data: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('demo-event', (data: any) => {
      this.data = data;
    });
  }
}

