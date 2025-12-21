import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEventHubService } from 'ngx-event-hub';

interface Activity {
  action: string;
  timestamp: Date;
  data?: any;
}

@Component({
  selector: 'app-user-activity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-activity.component.html',
  styleUrl: './user-activity.component.css'
})
export class UserActivityComponent implements OnInit {
  activities: Activity[] = [];
  maxActivities: number = 20;

  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('userAction', (data: any) => {
      this.addActivity(data);
    });
    
    // Also track test events as user actions
    this.eventHub.on('test', (data: any) => {
      this.addActivity(`Sent test event: "${data}"`);
    });
    
    // Track counter events
    this.eventHub.on('counter', (data: any) => {
      this.addActivity(`Counter incremented by: ${data}`);
    });
  }

  private addActivity(action: string | any) {
    const activity: Activity = {
      action: typeof action === 'string' ? action : JSON.stringify(action),
      timestamp: new Date(),
      data: action
    };
    
    this.activities.unshift(activity);
    
    if (this.activities.length > this.maxActivities) {
      this.activities = this.activities.slice(0, this.maxActivities);
    }
  }

  clearActivities() {
    this.activities = [];
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }
}

