import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-sender',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <input 
        type="text" 
        [(ngModel)]="message" 
        placeholder="Enter message..."
        (keyup.enter)="send()"
        style="padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px; width: 200px; margin-right: 8px;"
      />
      <button 
        (click)="send()" 
        style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Send Event
      </button>
    </div>
  `
})
export class ExampleSenderComponent {
  message: string = 'Hello from NgxEventHub!';
  
  constructor(private eventHub: NgxEventHubService) {}

  send(): void {
    if (this.message.trim()) {
      this.eventHub.cast('demo-event', this.message);
      this.message = '';
    }
  }
}

