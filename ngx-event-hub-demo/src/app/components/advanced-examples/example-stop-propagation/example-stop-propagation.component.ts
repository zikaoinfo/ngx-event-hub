import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-stop-propagation',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="margin-bottom: 12px;">
        <button 
          (click)="send()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Event (with stop)
        </button>
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: #E8F5E9; border-radius: 4px;">
        <strong>Listener 1:</strong> {{ msg1 || '(none)' }}
        <div style="font-size: 11px; color: var(--text-secondary);">Returns false (stops propagation)</div>
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: #FFF3E0; border-radius: 4px;">
        <strong>Listener 2:</strong> {{ msg2 || '(none)' }}
        <div style="font-size: 11px; color: var(--text-secondary);">Should not receive event</div>
      </div>
    </div>
  `
})
export class ExampleStopPropagationComponent implements OnInit {
  msg1: string = '';
  msg2: string = '';

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('stop-demo', () => {
      this.msg1 = 'Received (stopped propagation)';
      return false; // Stops propagation
    });

    this.eventHub.on('stop-demo', () => {
      this.msg2 = 'This should not appear';
    });
  }

  send(): void {
    this.msg1 = '';
    this.msg2 = '';
    this.eventHub.cast('stop-demo', 'data', { stopOnReturn: true });
  }
}

