import { Component, Input, ViewChild, ViewContainerRef, ComponentRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CodeExample {
  title: string;
  description: string;
  html: string;
  ts: string;
  previewComponent?: any;
  previewData?: any;
}

@Component({
  selector: 'app-code-example',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './code-example.component.html',
  styleUrl: './code-example.component.css'
})
export class CodeExampleComponent implements AfterViewInit, OnDestroy {
  @Input() example!: CodeExample;
  @ViewChild('previewContainer', { read: ViewContainerRef }) previewContainer!: ViewContainerRef;
  
  activeTab: 'html' | 'js' | 'preview' = 'preview';
  private componentRef?: ComponentRef<any>;
  copied = false;

  ngAfterViewInit(): void {
    if (this.activeTab === 'preview' && this.example.previewComponent) {
      setTimeout(() => this.loadPreview(), 0);
    }
  }

  ngOnDestroy(): void {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }

  setTab(tab: 'html' | 'js' | 'preview'): void {
    this.activeTab = tab;
    if (tab === 'preview' && this.example.previewComponent) {
      setTimeout(() => this.loadPreview(), 0);
    }
  }

  private loadPreview(): void {
    if (this.previewContainer && this.example.previewComponent) {
      if (this.componentRef) {
        this.componentRef.destroy();
      }
      this.componentRef = this.previewContainer.createComponent(this.example.previewComponent);
    }
  }

  copyToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 2000);
    });
  }
}

