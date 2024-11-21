import { Component } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-reciver2',
  standalone: true,
  imports: [],
  templateUrl: './reciver2.component.html',
  styleUrl: './reciver2.component.css'
})
export class Reciver2Component {
  previousData: string = '';
  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('test', (data: any, previousData) => {
      this.previousData = previousData;
    });
  }
}
