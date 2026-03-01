import { Injectable, signal, DOCUMENT, inject } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'pypad_theme';
const CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly mode = signal<ThemeMode>(this.loadPreference());

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    const next = CYCLE[(CYCLE.indexOf(this.mode()) + 1) % CYCLE.length];
    this.mode.set(next);
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
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
