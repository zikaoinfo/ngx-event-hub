import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let mediaListeners: Array<(e: { matches: boolean }) => void>;
  let prefersDark: boolean;

  beforeEach(() => {
    mediaListeners = [];
    prefersDark = false;
    // jsdom has no matchMedia — emulate it.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: prefersDark,
        media: query,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
          mediaListeners.push(cb),
        removeEventListener: jest.fn(),
      })),
    });
    TestBed.configureTestingModule({ providers: [ThemeService] });
  });

  it('defaults to zen-arctic + auto scheme', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('zen-arctic');
    expect(service.resolvedScheme()).toBe('light');
    expect(service.hostClasses()).toBe('zen-arctic zen-scheme-light');
  });

  it('manual dark mode overrides the system preference', () => {
    const service = TestBed.inject(ThemeService);
    service.setDarkMode('dark');
    expect(service.resolvedScheme()).toBe('dark');
    service.setDarkMode('light');
    expect(service.resolvedScheme()).toBe('light');
  });

  it('auto mode follows prefers-color-scheme changes live', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.resolvedScheme()).toBe('light');
    mediaListeners.forEach((cb) => cb({ matches: true }));
    expect(service.resolvedScheme()).toBe('dark');
  });

  it('switching themes updates host classes', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('zen-carbon');
    expect(service.hostClasses()).toContain('zen-carbon');
  });

  it('icon provider can be swapped', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.icon('sort-asc')).toBe('↑');
    service.setIconProvider({ icon: () => 'X' });
    expect(service.icon('filter')).toBe('X');
  });

  it.todo('SSR render resolves to light without touching matchMedia');
});
