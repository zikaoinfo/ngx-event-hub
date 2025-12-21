import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example-debounce',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div style="padding: 16px; background: var(--primary-light); border-radius: var(--radius-sm);">
      <div style="margin-bottom: 12px;">
        <input 
          [(ngModel)]="inputValue"
          (input)="onInput($event)"
          placeholder="Type quickly..."
          style="width: 100%; padding: 8px 12px; border: 1px solid var(--border); border-radius: 4px;"
        />
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Raw inputs:</strong> {{ inputCount }}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Debounced value:</strong> {{ debouncedValue || '(none)' }}
      </div>
      <div style="font-size: 12px; color: var(--text-secondary);">
        ⏱️ Only fires after 300ms of no typing
      </div>
    </div>
  `
})
export class ExampleDebounceComponent implements OnInit {
  inputValue: string = '';
  debouncedValue: string = '';
  inputCount: number = 0;

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('debounce-demo', (data: any) => {
      this.debouncedValue = data;
    }, { debounce: 300 });
  }

  onInput(event: Event): void {
    this.inputCount++;
    const value = (event.target as HTMLInputElement).value;
    this.eventHub.cast('debounce-demo', value);
  }
}

