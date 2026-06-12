import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start with the mobile menu closed', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.isMobileMenuOpen).toBeFalse();
  });

  it('should toggle and close the mobile menu', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();

    app.toggleMobileMenu();
    expect(app.isMobileMenuOpen).toBeTrue();

    app.closeMobileMenu();
    expect(app.isMobileMenuOpen).toBeFalse();
  });
});
