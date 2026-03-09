import { Injectable, DOCUMENT, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/** Minimal typings for the xterm.js Terminal (bundled inside public/pyscript/). */
interface XTerminal {
  onData(handler: (data: string) => void): void;
  write(data: string | Uint8Array): void;
  clear(): void;
  open(el: HTMLElement): void;
  focus(): void;
  dispose(): void;
  options: Record<string, unknown>;
}
interface FitAddon {
  activate(terminal: XTerminal): void;
  fit(): void;
}
interface XTermModule {
  Terminal: new (options?: Record<string, unknown>) => XTerminal;
}
interface FitAddonModule {
  FitAddon: new () => FitAddon;
}

/** Minimal typings for a MicroPython WASM interpreter instance. */
interface MicroPythonInterpreter {
  replInit(): void;
  replProcessChar(byte: number): void;
}

/** Options accepted by `loadMicroPython` from `micropython.mjs`. */
interface LoadMicroPythonOptions {
  stdout?: (data: Uint8Array) => void;
  stderr?: (data: Uint8Array) => void;
  linebuffer?: boolean;
  heapsize?: number;
  pystack?: number;
  url?: string;
}

/** JS objects exposed by PyScript when the MicroPython WASM runtime is ready. */
declare global {
  interface Window {
    pypad_interpreter?: MicroPythonInterpreter;
    pypad_io?: {
      stdout: ((data: Uint8Array) => void) | null;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ReplService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** True once `window.pypad_interpreter` is available. */
  readonly isReady = signal(false);

  /** The xterm FitAddon instance, available after `startRepl()` resolves. */
  fitAddon: FitAddon | null = null;

  private terminal: XTerminal | null = null;
  private readonly _encoder = new TextEncoder();
  /** The active MicroPython interpreter. Updated on every reset. */
  private _interpreter: MicroPythonInterpreter | null = null;

  constructor() {
    const win = this.doc.defaultView as Window;
    if (win.pypad_interpreter) {
      this.isReady.set(true);
    } else {
      interval(200)
        .pipe(
          filter(() => !!win.pypad_interpreter),
          take(1),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.isReady.set(true));
    }
  }

  /**
   * Initialises an xterm.js terminal inside `hostEl` and connects it to the
   * MicroPython REPL. Safe to call only once. Resolves after the terminal is ready.
   */
  async startRepl(hostEl: HTMLElement, isDark: boolean): Promise<void> {
    const win = this.doc.defaultView as Window;
    const interpreter = win.pypad_interpreter;
    const io = win.pypad_io;
    if (!interpreter || !io) return;

    // Inject xterm.css once.
    const cssHref = './pyscript/xterm.css';
    if (!this.doc.querySelector(`link[href="${cssHref}"]`)) {
      const link = this.doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      this.doc.head.appendChild(link);
    }

    // Resolve pyscript files relative to the document's base URL so that
    // sub-path deployments (e.g. GitHub Pages /pypad/) are handled correctly.
    const baseUrl = new URL('pyscript/', this.doc.baseURI).href;
    const xtermFiles = this._resolveXtermFiles(baseUrl);

    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import(/* @vite-ignore */ xtermFiles.xterm) as Promise<XTermModule>,
      import(/* @vite-ignore */ xtermFiles.fitAddon) as Promise<FitAddonModule>,
    ]);

    const theme = this._themeFor(isDark);

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Roboto Mono", "Courier New", monospace',
      lineHeight: 1.4,
      theme,
      convertEol: false,
    });

    const fit = new FitAddon();
    fit.activate(terminal);
    this.fitAddon = fit;

    terminal.open(hostEl);
    fit.fit();
    terminal.focus();
    this.terminal = terminal;

    // Route MicroPython stdout → terminal (convert bare LF to CRLF).
    const cr = new Uint8Array([13]);
    io.stdout = (data: Uint8Array) => {
      if (data[0] === 10) terminal.write(cr);
      terminal.write(data);
    };

    // Start the MicroPython REPL state machine.
    this._interpreter = interpreter;
    interpreter.replInit();

    // Route terminal keystrokes → current interpreter (read via this._interpreter
    // so resets transparently swap to a new instance).
    terminal.onData((chars: string) => {
      const bytes = this._encoder.encode(chars);
      for (const byte of bytes) {
        this._interpreter?.replProcessChar(byte);
      }
    });
  }

  /** Updates the terminal colour scheme without restarting the REPL. */
  setTheme(isDark: boolean): void {
    if (this.terminal) {
      this.terminal.options['theme'] = this._themeFor(isDark);
    }
  }

  /**
   * Creates a brand-new MicroPython WASM interpreter instance, swaps it in,
   * and clears the terminal. All previously defined Python globals are gone
   * because the entire heap is discarded with the old instance.
   * Safe to call at any time after `startRepl()` has resolved.
   */
  async resetRepl(): Promise<void> {
    if (!this.terminal) return;
    const newInterpreter = await this._createFreshInterpreter(this.terminal);
    this._interpreter = newInterpreter;
    (this.doc.defaultView as Window).pypad_interpreter = newInterpreter;
    newInterpreter.replInit();
    this.terminal.clear();
  }

  /**
   * Resets the REPL (fresh interpreter) then executes `code` via MicroPython
   * paste mode (Ctrl+E … bytes … Ctrl+D) so that the new run's variables
   * remain inspectable afterward.
   *
   * If the terminal has not been started yet (user has never opened the REPL
   * tab), this is a no-op — the caller should switch to the REPL tab first so
   * that `ngAfterViewInit` triggers `startRepl()`, then try again.
   */
  async runInRepl(code: string): Promise<void> {
    if (!this.terminal) return;
    await this.resetRepl();
    const interpreter = this._interpreter;
    if (!interpreter) return;

    // Enter paste mode, send the code, then execute.
    interpreter.replProcessChar(0x05); // Ctrl+E
    const bytes = this._encoder.encode(code);
    for (const byte of bytes) {
      interpreter.replProcessChar(byte);
    }
    interpreter.replProcessChar(0x04); // Ctrl+D
  }

  /**
   * Instantiates a fresh MicroPython WASM module and wires its stdout directly
   * to the terminal. Each call loads a new WASM instance with a clean heap.
   */
  private async _createFreshInterpreter(terminal: XTerminal): Promise<MicroPythonInterpreter> {
    const mpjsUrl = new URL('pyscript/micropython/micropython.mjs', this.doc.baseURI).href;
    const { loadMicroPython } = (await import(/* @vite-ignore */ mpjsUrl)) as {
      loadMicroPython: (options: LoadMicroPythonOptions) => Promise<MicroPythonInterpreter>;
    };
    const cr = new Uint8Array([13]);
    return loadMicroPython({
      linebuffer: false,
      stdout: (data: Uint8Array) => {
        if (data[0] === 10) terminal.write(cr);
        terminal.write(data);
      },
    });
  }

  private _themeFor(isDark: boolean): Record<string, string> {
    return isDark
      ? { background: '#1e1e1e', foreground: '#d4d4d4' }
      : { background: '#ffffff', foreground: '#1e1e1e', cursor: '#1e1e1e' };
  }

  /**
   * Returns the hashed filenames for the xterm bundles.
   * Update these filenames when upgrading pyscript.
   */
  private _resolveXtermFiles(baseUrl: string): { xterm: string; fitAddon: string } {
    return {
      xterm: `${baseUrl}xterm-DrSYbXEP.js`,
      fitAddon: `${baseUrl}xterm_addon-fit-DxKdSnof.js`,
    };
  }
}
