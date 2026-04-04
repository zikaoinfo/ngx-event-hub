import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-counter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './counter.component.html',
  styleUrl: './counter.component.css'
})
export class CounterComponent implements OnInit {
  count: number = 0;
  lastUpdate: Date | null = null;
  private pulseTimeout: any;

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('counter', (data: any) => {
      const increment = typeof data === 'number' ? data : 1;
      this.count += increment;
      this.lastUpdate = new Date();
      this.triggerPulse();
    });
  }

  reset(): void {
    this.count = 0;
    this.lastUpdate = null;
  }

  increment(amount: number = 1): void {
    this.eventHub.cast('counter', amount);
  }

  shouldPulse(): boolean {
    return !!this.pulseTimeout;
  }

  private triggerPulse(): void {
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
    }
    
    this.pulseTimeout = setTimeout(() => {
      this.pulseTimeout = null;
    }, 300);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }
}

