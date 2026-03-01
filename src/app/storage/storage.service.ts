import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

const STORAGE_KEY = 'pypad_code';
const DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly saveQueue = new Subject<string>();

  constructor() {
    this.saveQueue
      .pipe(debounceTime(DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((code) => {
        try {
          localStorage.setItem(STORAGE_KEY, code);
        } catch {
          // localStorage may be unavailable (private browsing quota exceeded, etc.)
        }
      });
  }

  load(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  save(code: string): void {
    this.saveQueue.next(code);
  }
}
