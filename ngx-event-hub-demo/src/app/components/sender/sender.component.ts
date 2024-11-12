import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-sender',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './sender.component.html',
  styleUrl: './sender.component.css'
})
export class SenderComponent {
  dataTosend: string = '';
  constructor(private eventHub: NgxEventHubService) {

  }

  triggerEvent() {
    this.eventHub.cast('test', this.dataTosend);
  }

}
