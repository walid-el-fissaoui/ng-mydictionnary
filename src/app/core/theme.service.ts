import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'mydictionnary.theme';

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(readMode());
  private readonly systemDark = signal(matchMedia('(prefers-color-scheme: dark)').matches);

  /** The theme actually applied. */
  readonly effective = computed<'light' | 'dark'>(() =>
    this.mode() === 'system' ? (this.systemDark() ? 'dark' : 'light') : (this.mode() as 'light' | 'dark'),
  );

  constructor() {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) =>
      this.systemDark.set(e.matches),
    );
    effect(() => {
      const theme = this.effective();
      const root = document.documentElement;
      root.dataset['theme'] = theme;
      root.style.colorScheme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#ffffff');
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Storage unavailable: the choice just isn't remembered.
    }
  }

  /** Quick toggle from the top bar: switches to the opposite of what is showing. */
  toggle(): void {
    this.set(this.effective() === 'dark' ? 'light' : 'dark');
  }
}
