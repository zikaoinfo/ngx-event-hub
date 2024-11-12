import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxEventHubService } from 'ngx-event-hub';
import { SenderComponent } from './components/sender/sender.component';
import { ReciverComponent } from './components/reciver/reciver.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SenderComponent, ReciverComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
}
