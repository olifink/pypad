import { Injectable, signal, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/** Exposed by the inline MicroPython script in index.html once PyScript has initialised. */
declare global {
  interface Window {
    pypad_run?: (code: string) => string;
  }
}

@Injectable({ providedIn: 'root' })
export class RunnerService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** True once the MicroPython runtime has initialised and pypad_run is available. */
  readonly isReady = signal(false);

  constructor() {
    const win = this.doc.defaultView;
    if (win?.pypad_run) {
      this.isReady.set(true);
    } else {
      // Poll every 200ms — avoids missing the py:ready event due to load-order races.
      interval(200)
        .pipe(
          filter(() => !!win?.pypad_run),
          take(1),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.isReady.set(true));
    }
  }

  /**
   * Executes the given Python code string via MicroPython (synchronous, main thread).
   * Returns captured stdout/stderr split into lines.
   */
  run(code: string): string[] {
    const pyRun = this.doc.defaultView?.pypad_run;
    if (!pyRun) {
      return ['PyScript runtime is not ready yet. Please wait a moment and try again.'];
    }
    const raw = pyRun(code);
    const lines = raw.split('\n');
    // Remove the trailing empty string left by a final newline.
    if (lines.at(-1) === '') lines.pop();
    return lines.length > 0 ? lines : ['(no output)'];
  }
}
