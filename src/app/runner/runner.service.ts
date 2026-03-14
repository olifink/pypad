import { Injectable, signal, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/** A single line of output from a Python run, tagged as normal output or error. */
export interface OutputLine {
  text: string;
  isError: boolean;
}

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
   * Returns captured stdout and stderr split into tagged output lines.
   */
  run(code: string): OutputLine[] {
    const pyRun = this.doc.defaultView?.pypad_run;
    if (!pyRun) {
      return [
        {
          text: 'PyScript runtime is not ready yet. Please wait a moment and try again.',
          isError: true,
        },
      ];
    }

    const result = JSON.parse(pyRun(code)) as { out: string; err: string };
    const lines: OutputLine[] = [];

    if (result.out) {
      const outLines = result.out.split('\n');
      if (outLines.at(-1) === '') outLines.pop();
      outLines.forEach((text) => lines.push({ text, isError: false }));
    }

    if (result.err) {
      const errLines = result.err.split('\n');
      if (errLines.at(-1) === '') errLines.pop();
      errLines.forEach((text) => lines.push({ text, isError: true }));
    }

    return lines.length > 0 ? lines : [{ text: '(no output)', isError: false }];
  }
}
