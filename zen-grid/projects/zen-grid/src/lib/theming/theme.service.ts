/**
 * Theme management: built-in themes (zen-arctic, zen-slate, zen-carbon),
 * dark mode via prefers-color-scheme with manual override, and an icon
 * provider abstraction.
 *
 * Themes are pure CSS custom properties (see zen-grid.component.scss).
 * This service only toggles attributes — no style recalculation storms.
 */
import {
  DestroyRef,
  Injectable,
  PLATFORM_ID,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ZenTheme = 'zen-arctic' | 'zen-slate' | 'zen-carbon';
export type DarkModeSetting = 'light' | 'dark' | 'auto';

/** Swap the icon set by providing a different implementation. */
export interface ZenIconProvider {
  /** Returns the glyph/text/SVG-name for a semantic icon key. */
  icon(name: ZenIconName): string;
}

export type ZenIconName =
  | 'sort-asc' | 'sort-desc' | 'filter' | 'expand' | 'collapse'
  | 'pin' | 'menu' | 'check' | 'close' | 'drag';

const DEFAULT_ICONS: Record<ZenIconName, string> = {
  'sort-asc': '↑',
  'sort-desc': '↓',
  filter: '⏷',
  expand: '▸',
  collapse: '▾',
  pin: '📌',
  menu: '⋮',
  check: '✓',
  close: '✕',
  drag: '⠿',
};

@Injectable()
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly theme = signal<ZenTheme>('zen-arctic');
  readonly darkMode = signal<DarkModeSetting>('auto');
  /** Live value of the OS-level prefers-color-scheme media query. */
  private readonly systemPrefersDark = signal(false);
  private iconProvider: ZenIconProvider = { icon: (name) => DEFAULT_ICONS[name] };

  /** The effective scheme after resolving 'auto'. */
  readonly resolvedScheme: Signal<'light' | 'dark'> = computed(() => {
    const setting = this.darkMode();
    if (setting !== 'auto') return setting;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  /** CSS classes the grid host binds: theme name + scheme. */
  readonly hostClasses: Signal<string> = computed(
    () => `${this.theme()} zen-scheme-${this.resolvedScheme()}`,
  );

  constructor() {
    // SSR-GUARD: matchMedia is browser-only; SSR renders the light scheme
    // and the correct scheme applies on hydration without layout shift
    // (colors only).
    if (isPlatformBrowser(this.platformId)) {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPrefersDark.set(query.matches);
      const listener = (e: MediaQueryListEvent): void => this.systemPrefersDark.set(e.matches);
      query.addEventListener('change', listener);
      this.destroyRef.onDestroy(() => query.removeEventListener('change', listener));
    }
  }

  setTheme(theme: ZenTheme): void {
    this.theme.set(theme);
  }

  setDarkMode(setting: DarkModeSetting): void {
    this.darkMode.set(setting);
  }

  setIconProvider(provider: ZenIconProvider): void {
    this.iconProvider = provider;
  }

  icon(name: ZenIconName): string {
    return this.iconProvider.icon(name);
  }
}
