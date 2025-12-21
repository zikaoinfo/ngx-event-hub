import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-sender-receiver',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
        <div style="font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">Sender</div>
        <input 
          type="text" 
          [(ngModel)]="message" 
          placeholder="Enter message..."
          (keyup.enter)="send()"
          style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px; width: 100%; margin-bottom: 8px;"
        />
        <button 
          (click)="send()" 
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
        >
          Send Event
        </button>
      </div>
      
      <div style="padding: 16px; background: #E8F5E9; border-radius: var(--radius-sm);">
        <div style="font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">Receiver</div>
        <div [style.color]="received ? 'var(--success)' : 'var(--text-secondary)'" style="font-size: 16px; min-height: 24px; padding: 8px 0;">
          {{ received || 'Waiting for events...' }}
        </div>
      </div>
    </div>
  `
})
export class ExampleSenderReceiverComponent {
  message: string = '';
  received: string = '';
  
  constructor(private eventHub: NgxEventHubService) {
    this.eventHub.on('demo-event', (data: any) => {
      this.received = data;
    });
  }

  send(): void {
    if (this.message.trim()) {
      this.eventHub.cast('demo-event', this.message);
      this.message = '';
    }
  }
}

