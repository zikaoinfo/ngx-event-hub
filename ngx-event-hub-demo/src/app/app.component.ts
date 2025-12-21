import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SenderComponent } from './components/sender/sender.component';
import { ReciverComponent } from './components/reciver/reciver.component';
import { Reciver2Component } from './components/reciver2/reciver2.component';
import { CounterComponent } from './components/counter/counter.component';
import { UserActivityComponent } from './components/user-activity/user-activity.component';
import { CodeExamplesComponent } from './components/code-examples/code-examples.component';
import { AdvancedExamplesComponent } from './components/advanced-examples/advanced-examples.component';
import { NavigationComponent } from './components/navigation/navigation.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, 
    SenderComponent, 
    ReciverComponent, 
    Reciver2Component,
    CounterComponent,
    UserActivityComponent,
    CodeExamplesComponent,
    AdvancedExamplesComponent,
    NavigationComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements AfterViewInit {
  @ViewChild('navigation') navigationComponent!: NavigationComponent;
  isMobileMenuOpen = false;

  ngAfterViewInit(): void {
    // Component initialized
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    if (this.navigationComponent) {
      this.navigationComponent.isOpen = this.isMobileMenuOpen;
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    if (this.navigationComponent) {
      this.navigationComponent.closeMenu();
    }
  }
}
