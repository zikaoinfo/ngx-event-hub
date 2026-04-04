import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-destroy-ref',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: #E8F5E9; border-radius: var(--radius-sm);">
      <div style="margin-bottom: 12px;">
        <strong>✅ Auto-unsubscribe enabled</strong>
      </div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        Listener automatically unsubscribes when this component is destroyed (try navigating away)
      </p>
      <button 
        (click)="sendEvent()"
        style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Send Event
      </button>
      <div style="margin-top: 12px;">
        <strong>Received:</strong> {{ message || '(none)' }}
      </div>
    </div>
  `
})
export class ExampleDestroyRefComponent implements OnInit {
  message: string = '';
  private destroyRef = inject(DestroyRef);

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('destroy-ref-demo', (data: any) => {
      this.message = data;
    }, { destroyRef: this.destroyRef });
  }

  sendEvent(): void {
    this.eventHub.cast('destroy-ref-demo', `Event at ${new Date().toLocaleTimeString()}`);
  }
}

