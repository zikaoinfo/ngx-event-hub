import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-scope',
  standalone: true,
  imports: [],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
        <button 
          (click)="sendGlobal()"
          style="padding: 8px 16px; background: var(--secondary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Global
        </button>
        <button 
          (click)="sendScoped()"
          style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Send Scoped
        </button>
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px;">
        <strong>Global hub received:</strong> {{ globalMsg || '(none)' }}
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px;">
        <strong>Scoped hub received:</strong> {{ scopedMsg || '(none)' }}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        🏷️ Scoped hubs are isolated - events don't cross boundaries
      </div>
    </div>
  `
})
export class ExampleScopeComponent implements OnInit {
  globalMsg: string = '';
  scopedMsg: string = '';
  private scopedHub!: NgxEventHubService;

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('scope-demo', (data: any) => {
      this.globalMsg = data;
    });

    this.scopedHub = this.eventHub.createScope('feature');
    this.scopedHub.on('scope-demo', (data: any) => {
      this.scopedMsg = data;
    });
  }

  sendGlobal(): void {
    this.globalMsg = '';
    this.scopedMsg = '';
    this.eventHub.cast('scope-demo', 'Global event');
  }

  sendScoped(): void {
    this.globalMsg = '';
    this.scopedMsg = '';
    this.scopedHub.cast('scope-demo', 'Scoped event');
  }
}

