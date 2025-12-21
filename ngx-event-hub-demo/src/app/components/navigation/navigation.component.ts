import { Component, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.css'
})
export class NavigationComponent implements OnInit, OnDestroy {
  @Output() menuStateChange = new EventEmitter<boolean>();
  isOpen = false;
  activeSection: string = '';

  navItems: NavItem[] = [
    {
      id: 'basic-examples',
      label: 'Basic Examples',
      icon: '📚',
      children: [
        { id: 'basic-event-communication', label: 'Basic Event Communication', icon: '💬' },
        { id: 'multiple-receivers', label: 'Multiple Receivers', icon: '📡' },
        { id: 'real-time-counter', label: 'Real-time Counter', icon: '🔢' },
        { id: 'activity-tracker', label: 'Activity Tracker', icon: '📊' }
      ]
    },
    {
      id: 'code-examples',
      label: 'Code Examples',
      icon: '💻'
    },
    {
      id: 'advanced-examples',
      label: 'Advanced Examples',
      icon: '🚀'
    }
  ];

  expandedSections: Set<string> = new Set(['basic-examples']);
  private scrollTimeout?: any;

  ngOnInit(): void {
    // Initial check after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.updateActiveSection();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    // Throttle scroll events for better performance
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.updateActiveSection();
    }, 100);
  }

  updateActiveSection(): void {
    const sections = [
      'basic-event-communication',
      'multiple-receivers',
      'real-time-counter',
      'activity-tracker',
      'code-examples',
      'advanced-examples'
    ];

    const scrollOffset = 150; // Offset from top to consider section active
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

    // Find the section currently in view
    let activeId = '';
    
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = document.getElementById(sections[i]);
      if (section) {
        const sectionTop = section.offsetTop - scrollOffset;
        if (currentScroll >= sectionTop) {
          activeId = sections[i];
          break;
        }
      }
    }

    // If we're at the top, set the first section as active
    if (!activeId && sections.length > 0) {
      activeId = sections[0];
    }

    this.activeSection = activeId;
  }

  isSectionActive(sectionId: string): boolean {
    return this.activeSection === sectionId;
  }

  toggleSection(sectionId: string): void {
    if (this.expandedSections.has(sectionId)) {
      this.expandedSections.delete(sectionId);
    } else {
      this.expandedSections.add(sectionId);
    }
  }

  isExpanded(sectionId: string): boolean {
    return this.expandedSections.has(sectionId);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Close menu on mobile after selection
      if (window.innerWidth <= 1024) {
        this.closeMenu();
      }
    }
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  closeMenu(): void {
    this.isOpen = false;
    this.menuStateChange.emit(false);
  }
}

