import { Injectable, signal, computed, DOCUMENT, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'pypad_theme';
const CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly systemIsDark = signal(
    this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false,
  );

  readonly mode = signal<ThemeMode>(this.loadPreference());

  /** Resolves the effective dark state, including when mode is 'system'. */
  readonly effectiveIsDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.systemIsDark()),
  );

  constructor() {
    this.apply(this.mode());

    // Keep systemIsDark in sync when the OS preference changes.
    this.doc.defaultView
      ?.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => this.systemIsDark.set(e.matches));
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }

  toggle(): void {
    this.setMode(CYCLE[(CYCLE.indexOf(this.mode()) + 1) % CYCLE.length]);
  }

  private apply(mode: ThemeMode): void {
    // 'light dark' defers to the OS preference; explicit values override it.
    this.doc.body.style.colorScheme = mode === 'system' ? 'light dark' : mode;
  }

  private loadPreference(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored && CYCLE.includes(stored)) return stored;
    } catch {
      // ignore
    }
    return 'system';
  }
}
