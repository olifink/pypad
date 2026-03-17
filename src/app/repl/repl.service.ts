import { Injectable, DOCUMENT, DestroyRef, inject, signal, computed, effect } from '@angular/core';
import { PackagesService } from '../packages/packages.service';
import { BoardService } from '../board/board.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/** Minimal typings for the xterm.js Terminal (bundled inside public/pyscript/). */
interface XTerminal {
  onData(handler: (data: string) => void): { dispose(): void };
  write(data: string | Uint8Array): void;
  clear(): void;
  reset(): void;
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
  runPython(code: string): string;
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
      stderr: ((data: Uint8Array) => void) | null;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ReplService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly packages = inject(PackagesService);
  private readonly board = inject(BoardService);

  private readonly _wasmReady = signal(false);

  /** True once the REPL can be started (WASM ready or board connected). */
  readonly isReady = computed(() => this._wasmReady() || this.board.isConnected());

  /** The xterm FitAddon instance, available after `startRepl()` resolves. */
  fitAddon: FitAddon | null = null;

  private terminal: XTerminal | null = null;
  private readonly _encoder = new TextEncoder();
  /** The active MicroPython interpreter. Updated on every reset. */
  private _interpreter: MicroPythonInterpreter | null = null;
  /** Disposable for the active terminal onData subscription. */
  private _onDataDisposable: { dispose(): void } | null = null;

  constructor() {
    const win = this.doc.defaultView as Window;
    if (win.pypad_interpreter) {
      this._wasmReady.set(true);
    } else {
      interval(200)
        .pipe(
          filter(() => !!win.pypad_interpreter),
          take(1),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this._wasmReady.set(true));
    }

    // Re-wire the terminal whenever board connection state changes.
    // If the terminal hasn't been opened yet, startRepl() will handle it.
    effect(() => {
      const connected = this.board.isConnected();
      if (!this.terminal) return;
      if (connected) {
        this._clearWasmIo();
        this._wireBoardToTerminal();
        this.terminal?.reset();
        void this.board.writeBytes(new Uint8Array([0x0d]));
      } else {
        this.board.setReplHandler(null);
        void this._reinitWasmRepl();
      }
    });
  }

  /**
   * Initialises an xterm.js terminal inside `hostEl` and connects it either
   * to the board (if connected) or to the MicroPython WASM REPL.
   * Safe to call only once. Resolves after the terminal is ready.
   */
  async startRepl(hostEl: HTMLElement, isDark: boolean): Promise<void> {
    const usingBoard = this.board.isConnected();

    if (!usingBoard) {
      const win = this.doc.defaultView as Window;
      if (!win.pypad_interpreter || !win.pypad_io) return;
    }

    // Inject xterm.css once.
    const cssHref = './pyscript/xterm.css';
    if (!this.doc.querySelector(`link[href="${cssHref}"]`)) {
      const link = this.doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      this.doc.head.appendChild(link);
    }

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

    if (usingBoard) {
      this._wireBoardToTerminal();
    } else {
      this._wireWasmToTerminal();
      (this.doc.defaultView as Window).pypad_interpreter!.replInit();
    }
  }

  /** Updates the terminal colour scheme without restarting the REPL. */
  setTheme(isDark: boolean): void {
    if (this.terminal) {
      this.terminal.options['theme'] = this._themeFor(isDark);
    }
  }

  /**
   * Resets the REPL. For board: clears terminal and sends Ctrl+C+B.
   * For WASM: creates a fresh interpreter and reinstalls packages.
   */
  async resetRepl(): Promise<void> {
    if (!this.terminal) return;

    if (this.board.isConnected()) {
      this.terminal.reset();
      await this.board.writeBytes(new Uint8Array([0x03, 0x03, 0x02]));
      this.terminal.focus();
    } else {
      await this._reinitWasmRepl();
    }
  }

  /**
   * Resets the REPL then executes `code`. For board: uses MicroPython paste
   * mode (Ctrl+E … code … Ctrl+D). For WASM: uses the WASM paste mode.
   *
   * No-op if the terminal has not been started yet.
   */
  async runInRepl(code: string): Promise<void> {
    if (!this.terminal) return;

    if (this.board.isConnected()) {
      this.terminal.reset();
      const codeBytes = this._encoder.encode(code);
      const packet = new Uint8Array(codeBytes.length + 2);
      packet[0] = 0x05; // Ctrl+E — enter paste mode
      packet.set(codeBytes, 1);
      packet[packet.length - 1] = 0x04; // Ctrl+D — execute
      await this.board.writeBytes(packet);
    } else {
      await this.resetRepl();
      const interpreter = this._interpreter;
      if (!interpreter) return;
      interpreter.replProcessChar(0x05); // Ctrl+E
      const bytes = this._encoder.encode(code);
      for (const byte of bytes) {
        interpreter.replProcessChar(byte);
      }
      interpreter.replProcessChar(0x04); // Ctrl+D
    }
  }

  /** Wires the board's serial byte stream to xterm.js. */
  private _wireBoardToTerminal(): void {
    const terminal = this.terminal!;
    const cr = new Uint8Array([13]);
    this.board.setReplHandler((data: Uint8Array) => {
      if (data[0] === 10) terminal.write(cr);
      terminal.write(data);
    });
    this._onDataDisposable?.dispose();
    this._onDataDisposable = terminal.onData((chars: string) => {
      void this.board.writeBytes(this._encoder.encode(chars));
    });
  }

  /** Wires the WASM interpreter's io and keystrokes to xterm.js. Does not call replInit(). */
  private _wireWasmToTerminal(): void {
    const terminal = this.terminal!;
    const win = this.doc.defaultView as Window;
    const interpreter = win.pypad_interpreter!;
    const io = win.pypad_io!;

    const cr = new Uint8Array([13]);
    const ioHandler = (data: Uint8Array) => {
      if (data[0] === 10) terminal.write(cr);
      terminal.write(data);
    };
    io.stdout = ioHandler;
    io.stderr = ioHandler;

    this._interpreter = interpreter;

    this._onDataDisposable?.dispose();
    this._onDataDisposable = terminal.onData((chars: string) => {
      const bytes = this._encoder.encode(chars);
      for (const byte of bytes) {
        this._interpreter?.replProcessChar(byte);
      }
    });
  }

  /** Clears WASM io handlers so the WASM interpreter stops writing to the terminal. */
  private _clearWasmIo(): void {
    const win = this.doc.defaultView as Window;
    if (win.pypad_io) {
      win.pypad_io.stdout = null;
      win.pypad_io.stderr = null;
    }
    this._interpreter = null;
  }

  /** Creates a fresh WASM interpreter, re-wires it to the terminal, reinstalls packages. */
  private async _reinitWasmRepl(): Promise<void> {
    if (!this.terminal) return;
    const newInterpreter = await this._createFreshInterpreter(this.terminal);
    this._interpreter = newInterpreter;
    const win = this.doc.defaultView as Window;
    win.pypad_interpreter = newInterpreter;
    this._wireWasmToTerminal();
    await this.packages.reinstallAll();
    this.terminal.reset();
    newInterpreter.replInit();
    this.terminal.focus();
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
    const ioHandler = (data: Uint8Array) => {
      if (data[0] === 10) terminal.write(cr);
      terminal.write(data);
    };

    return loadMicroPython({
      linebuffer: false,
      stdout: ioHandler,
      stderr: ioHandler,
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
