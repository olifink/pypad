import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

const STORAGE_KEY = 'pypad_code';
const API_KEY_STORAGE_KEY = 'pypad_gemini_api_key';
const DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly saveQueue = new Subject<string>();
  private lastCode: string | null = null;

  constructor() {
    this.saveQueue
      .pipe(debounceTime(DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((code) => this.persist(code));
  }

  load(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /** Debounced save — called on every keystroke. */
  save(code: string): void {
    this.lastCode = code;
    this.saveQueue.next(code);
  }

  /** Immediate save — called by Ctrl+S, bypasses the debounce. */
  flush(): void {
    if (this.lastCode !== null) {
      this.persist(this.lastCode);
    }
  }

  private persist(code: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // localStorage may be unavailable (private browsing quota exceeded, etc.)
    }
  }

  loadApiKey(): string | null {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  saveApiKey(key: string | null): void {
    try {
      if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
      }
    } catch {
      // localStorage may be unavailable
    }
  }
}
