import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-reciver',
  standalone: true,
  imports: [],
  templateUrl: './reciver.component.html',
  styleUrl: './reciver.component.css'
})
export class ReciverComponent implements OnInit {
  data: string = '';
  constructor(private eventHub: NgxEventHubService) {

  }

  ngOnInit(): void {
    this.eventHub.on('test', (data: any) => {
      this.data = data;
    })
  }
}
