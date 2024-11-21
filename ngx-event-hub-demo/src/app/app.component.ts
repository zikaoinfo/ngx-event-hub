import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxEventHubService } from 'ngx-event-hub';
import { SenderComponent } from './components/sender/sender.component';
import { ReciverComponent } from './components/reciver/reciver.component';
import { Reciver2Component } from './components/reciver2/reciver2.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SenderComponent, ReciverComponent, Reciver2Component],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
}
