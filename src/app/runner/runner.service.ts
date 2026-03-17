import { Injectable, signal, computed, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { BoardService } from '../board/board.service';

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
  private readonly board = inject(BoardService);

  private readonly _workerReady = signal(false);

  /** True once the WASM worker is initialised, or a board is connected. */
  readonly isReady = computed(() => this._workerReady() || this.board.isConnected());

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
   * Executes the given Python code — on the board if connected, otherwise in
   * the WASM worker. Returns an Observable that emits output lines and
   * completes when execution finishes.
   */
  run(code: string): Observable<OutputLine> {
    this.isRunning.set(true);
    const src = this.board.isConnected() ? this.board.run(code) : this._workerRun(code);
    return new Observable((observer) => {
      const sub = src.subscribe({
        next: (v) => observer.next(v),
        error: (e) => { this.isRunning.set(false); observer.error(e); },
        complete: () => { this.isRunning.set(false); observer.complete(); },
      });
      return () => sub.unsubscribe();
    });
  }

  /** Stops any running script (interrupts the board or terminates the worker). */
  stop(): void {
    if (this.board.isConnected()) {
      this.board.stop();
    } else {
      this._stopWorker();
    }
  }

  /** Installs a package via `mip.install()` on the board or in the WASM worker. */
  install(name: string): Promise<InstallResult> {
    return this.board.isConnected()
      ? this.board.install(name)
      : this._workerInstall(name);
  }

  private _workerRun(code: string): Observable<OutputLine> {
    this.runSubject = new Subject<OutputLine>();
    this.worker.postMessage({ type: 'run', code });
    return this.runSubject.asObservable();
  }

  private _stopWorker(): void {
    this.worker?.terminate();
    if (this.runSubject) {
      this.runSubject.next({ text: 'Execution stopped.', isError: false });
      this.runSubject.complete();
      this.runSubject = null;
    }
    this.isRunning.set(false);
    this._workerReady.set(false);
    this._initWorker();
  }

  private _workerInstall(name: string): Promise<InstallResult> {
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
        this._workerReady.set(true);
        break;
      case 'line':
        this.runSubject?.next({ text: msg.text, isError: msg.isError });
        break;
      case 'done':
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
