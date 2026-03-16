import { Injectable, signal, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/** A single line of output from a Python run, tagged as normal output or error. */
export interface OutputLine {
  text: string;
  isError: boolean;
}

export interface InstallResult {
  success: boolean;
  log: string;
}

type WorkerOutMsg =
  | { type: 'ready' }
  | { type: 'line'; text: string; isError: boolean }
  | { type: 'done' }
  | { type: 'install_result'; id: string; success: boolean; log: string };

@Injectable({ providedIn: 'root' })
export class RunnerService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** True once the worker's MicroPython runtime has initialised. */
  readonly isReady = signal(false);

  /** True while a `run()` is in progress. */
  readonly isRunning = signal(false);

  private worker!: Worker;
  private runSubject: Subject<OutputLine> | null = null;
  private readonly pendingInstalls = new Map<string, (r: InstallResult) => void>();
  private installIdCounter = 0;

  constructor() {
    this._initWorker();
    this.destroyRef.onDestroy(() => this.worker?.terminate());
  }

  /**
   * Executes the given Python code in the worker.
   * Returns an Observable that emits output lines and completes when done.
   */
  run(code: string): Observable<OutputLine> {
    this.isRunning.set(true);
    this.runSubject = new Subject<OutputLine>();
    this.worker.postMessage({ type: 'run', code });
    return this.runSubject.asObservable();
  }

  /**
   * Terminates the worker (killing any running script), then starts a fresh one.
   */
  stop(): void {
    this.worker?.terminate();
    if (this.runSubject) {
      this.runSubject.next({ text: 'Execution stopped.', isError: false });
      this.runSubject.complete();
      this.runSubject = null;
    }
    this.isRunning.set(false);
    this.isReady.set(false);
    this._initWorker();
  }

  /**
   * Installs a package via `mip.install()` in the runner worker.
   */
  install(name: string): Promise<InstallResult> {
    return new Promise<InstallResult>((resolve) => {
      const id = String(this.installIdCounter++);
      this.pendingInstalls.set(id, resolve);
      this.worker.postMessage({ type: 'install', name, id });
    });
  }

  private _initWorker(): void {
    this.worker = new Worker(new URL('./runner.worker', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', (e: MessageEvent<WorkerOutMsg>) =>
      this._handleMessage(e),
    );
    this.worker.postMessage({ type: 'init', baseUrl: this.doc.baseURI });
  }

  private _handleMessage(e: MessageEvent<WorkerOutMsg>): void {
    const msg = e.data;
    switch (msg.type) {
      case 'ready':
        this.isReady.set(true);
        break;
      case 'line':
        this.runSubject?.next({ text: msg.text, isError: msg.isError });
        break;
      case 'done':
        this.isRunning.set(false);
        this.runSubject?.complete();
        this.runSubject = null;
        break;
      case 'install_result': {
        const resolve = this.pendingInstalls.get(msg.id);
        if (resolve) {
          this.pendingInstalls.delete(msg.id);
          resolve({ success: msg.success, log: msg.log });
        }
        break;
      }
    }
  }
}
