import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import type { OutputLine, InstallResult } from '../runner/runner.service';
import type { BoardFile, BoardInfo } from './board-info';

/** Web Serial API — not yet in TypeScript's lib.dom.d.ts */
declare global {
  interface Navigator {
    readonly serial: Serial;
  }
  interface Serial {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  }
  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
  }
  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
  }
  interface SerialPort extends EventTarget {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
  }
  interface SerialOptions {
    baudRate: number;
  }
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }
}

@Injectable({ providedIn: 'root' })
export class BoardService {
  readonly isConnected = signal(false);
  readonly portLabel = signal<string | null>(null);
  readonly boardInfo = signal<BoardInfo | null>(null);

  private _port: SerialPort | null = null;
  private _reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private _writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  /**
   * The handler currently receiving raw bytes from the read loop.
   * Raw REPL operations temporarily replace it with their own handler.
   */
  private _rxHandler: ((data: Uint8Array) => void) | null = null;
  /**
   * The handler ReplService wants active. Updated via `setReplHandler()` at
   * any time, including during raw REPL operations. Raw ops always restore
   * `_rxHandler` to this value when they finish, so updates are never lost.
   */
  private _replHandler: ((data: Uint8Array) => void) | null = null;
  private _rawModeActive = false;
  private readonly _decoder = new TextDecoder();

  /**
   * Opens a Web Serial port picker, connects to the board, and resets it to
   * a known idle state (Ctrl+C × 2 to interrupt, Ctrl+B for normal REPL).
   */
  async connect(): Promise<void> {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    this._port = port;
    this._writer = port.writable!.getWriter();

    // Interrupt any running code and return to the normal REPL prompt.
    await this._writeBytes(new Uint8Array([0x03, 0x03, 0x02]));

    this.isConnected.set(true);
    const info = port.getInfo();
    this.portLabel.set(info.usbProductId ? `USB (0x${info.usbProductId.toString(16)})` : 'Board');

    port.addEventListener('disconnect', () => void this.disconnect());
    this._startReadLoop();

    // Fire-and-forget probe; failure is silent.
    void this.probe();
  }

  /** Closes the serial port and resets all state. */
  async disconnect(): Promise<void> {
    this.isConnected.set(false);
    this.portLabel.set(null);
    this.boardInfo.set(null);
    this._rxHandler = null;
    this._replHandler = null;
    this._rawModeActive = false;
    // Cancel the reader first — port.close() throws if the readable stream is locked.
    try { await this._reader?.cancel(); } catch { /* ignore */ }
    this._reader = null;
    try { this._writer?.releaseLock(); } catch { /* ignore */ }
    this._writer = null;
    try { await this._port?.close(); } catch { /* ignore */ }
    this._port = null;
  }

  /**
   * Executes `code` on the board via the raw REPL protocol and streams each
   * output line as an `OutputLine`. Completes when execution finishes.
   */
  run(code: string): Observable<OutputLine> {
    const subject = new Subject<OutputLine>();
    void (async () => {
      // Guard so that setReplHandler() calls that arrive while we're in raw
      // REPL mode (e.g. from Angular effects) update _replHandler but do NOT
      // overwrite _rxHandler mid-operation. _rxHandler is always restored to
      // _replHandler when the operation ends.
      this._rawModeActive = true;
      try {
        await this._enterRaw();
        await this._execRaw(code, subject);
        await this._exitRaw();
      } catch (e) {
        subject.next({ text: String(e), isError: true });
      } finally {
        this._rawModeActive = false;
        this._rxHandler = this._replHandler;
        subject.complete();
      }
    })();
    return subject.asObservable();
  }

  /** Sends Ctrl+C × 2 to interrupt any running script on the board. */
  stop(): void {
    void this._writeBytes(new Uint8Array([0x03, 0x03]));
  }

  /**
   * Soft-resets the board (Ctrl+D in normal REPL mode). The MicroPython
   * interpreter restarts while the USB connection stays open.
   */
  softReset(): void {
    void this._writeBytes(new Uint8Array([0x04]));
  }

  /**
   * Writes `content` to `filename` on the board's filesystem via raw REPL.
   * Content is base64-encoded in the browser and decoded with `ubinascii` on
   * the board, so any text (including quotes, backslashes, Unicode) is safe.
   */
  async uploadFile(filename: string, content: string): Promise<void> {
    // Encode content as base64 in 60-char chunks.
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const b64 = btoa(binary);
    const chunks: string[] = [];
    for (let i = 0; i < b64.length; i += 60) chunks.push(b64.slice(i, i + 60));

    const writes = chunks.map((c) => `__f.write(__b('${c}'))`).join('\n');
    const code = [
      `from ubinascii import a2b_base64 as __b`,
      `__f = open(${JSON.stringify(filename)}, 'wb')`,
      writes,
      `__f.close()`,
      `del __f, __b`,
    ].join('\n');

    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(code).subscribe({
        next: (l) => { if (l.isError) errors.push(l.text); },
        error: reject,
        complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
      });
    });
  }

  /**
   * Reads `filename` from the board's filesystem and returns its content.
   * The board encodes the file as base64 (via `ubinascii`) and the browser
   * decodes it, so binary-safe round-trips work correctly.
   */
  async downloadFile(filename: string): Promise<string> {
    const code =
      `import ubinascii\n` +
      `print(ubinascii.b2a_base64(open(${JSON.stringify(filename)},'rb').read()).decode(),end='')`;

    let b64 = '';
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(code).subscribe({
        next: (l) => { if (l.isError) errors.push(l.text); else b64 += l.text; },
        error: reject,
        complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
      });
    });

    const binary = atob(b64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** Truncates `filename` to zero bytes on the board's filesystem. */
  async clearFile(filename: string): Promise<void> {
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(`open(${JSON.stringify(filename)},'w').close()`).subscribe({
        next: (l) => { if (l.isError) errors.push(l.text); },
        error: reject,
        complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
      });
    });
  }

  /**
   * Runs a discovery script on the board to capture platform info and memory
   * stats. Updates the `boardInfo` signal on success; silently ignores errors.
   */
  async probe(): Promise<void> {
    // Minimal script: no help(), no exec(), no extra stdout. Uses 1000000
    // instead of 1_000_000 for maximum MicroPython version compatibility.
    const script = [
      `import sys,gc,json`,
      `try:`,
      ` import machine`,
      ` _f=machine.freq()//1000000`,
      `except:`,
      ` _f=0`,
      `try:`,
      ` _b=sys.implementation._machine`,
      `except:`,
      ` _b=sys.platform`,
      `gc.collect()`,
      `print(json.dumps({"platform":sys.platform,"boardId":_b,"cpuFreqMhz":_f,"memFreeKb":gc.mem_free()//1024,"memAllocKb":gc.mem_alloc()//1024}))`,
    ].join('\n');

    try {
      let output = '';
      const errors: string[] = [];
      await new Promise<void>((resolve, reject) => {
        this.run(script).subscribe({
          next: (l) => { if (l.isError) errors.push(l.text); else output += l.text; },
          error: reject,
          complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
        });
      });
      const raw = JSON.parse(output.trim()) as {
        platform: string; boardId: string; cpuFreqMhz: number;
        memFreeKb: number; memAllocKb: number;
      };
      this.boardInfo.set({
        platform: raw.platform,
        boardId: raw.boardId,
        cpuFreqMhz: raw.cpuFreqMhz,
        memFreeKb: raw.memFreeKb,
        memAllocKb: raw.memAllocKb,
        modules: [],
      });
      // Update port label to use the board's own identifier.
      this.portLabel.set(raw.boardId || raw.platform);
    } catch {
      // Probe failure is non-fatal; boardInfo stays null.
    }
  }

  /**
   * Lists files/directories at `path` on the board's filesystem.
   * Returns an array of `BoardFile` objects sorted: dirs first, then files.
   */
  async listFiles(path = '/'): Promise<BoardFile[]> {
    const script = [
      `try:`,
      `  import uos as _os`,
      `except:`,
      `  import os as _os`,
      `import json`,
      `_r=[]`,
      `for _e in _os.ilistdir(${JSON.stringify(path)}):`,
      `  _r.append({"name":_e[0],"isDir":_e[1]==0x4000,"size":_e[3] if len(_e)>3 else 0})`,
      `print(json.dumps(_r))`,
    ].join('\n');

    let output = '';
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(script).subscribe({
        next: (l) => { if (l.isError) errors.push(l.text); else output += l.text; },
        error: reject,
        complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
      });
    });

    const raw = JSON.parse(output.trim()) as Array<{ name: string; isDir: boolean; size: number }>;
    return raw
      .map((e) => ({ name: e.name, size: e.size, isDir: e.isDir }))
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  }

  /** Removes a file at `path` from the board's filesystem. */
  async deleteFile(path: string): Promise<void> {
    const script = [
      `try:`,
      `  import uos as _os`,
      `except:`,
      `  import os as _os`,
      `_os.remove(${JSON.stringify(path)})`,
    ].join('\n');
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(script).subscribe({
        next: (l) => { if (l.isError) errors.push(l.text); },
        error: reject,
        complete: () => errors.length ? reject(new Error(errors.join('\n'))) : resolve(),
      });
    });
  }

  /** Runs `mip.install(name)` on the board and returns the result. */
  async install(name: string): Promise<InstallResult> {
    const lines: OutputLine[] = [];
    await new Promise<void>((resolve, reject) => {
      this.run(`import mip\nmip.install(${JSON.stringify(name)})`).subscribe({
        next: (l) => lines.push(l),
        error: reject,
        complete: resolve,
      });
    });
    const log = lines.map((l) => l.text).join('\n');
    const success = !lines.some((l) => l.isError);
    return { success, log };
  }

  /**
   * Registers a handler that receives raw bytes from the board. Used by
   * ReplService to pipe board output to xterm.js in normal REPL mode.
   * Always updates the intended REPL handler; if a raw REPL operation is in
   * progress the change takes effect when that operation completes.
   */
  setReplHandler(handler: ((data: Uint8Array) => void) | null): void {
    this._replHandler = handler;
    if (!this._rawModeActive) {
      this._rxHandler = handler;
    }
  }

  /** Sends raw bytes to the board (used by ReplService for keystrokes). */
  async writeBytes(data: Uint8Array): Promise<void> {
    await this._writeBytes(data);
  }

  private async _writeBytes(data: Uint8Array): Promise<void> {
    await this._writer?.write(data);
  }

  /**
   * Starts the single background read loop for the lifetime of the connection.
   * All incoming bytes are dispatched to `_rxHandler`.
   */
  private _startReadLoop(): void {
    void (async () => {
      if (!this._port?.readable) return;
      this._reader = this._port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await this._reader.read();
          if (done) break;
          if (value) this._rxHandler?.(value);
        }
      } catch { /* disconnected or cancelled */ } finally {
        try { this._reader?.releaseLock(); } catch { /* ignore */ }
        this._reader = null;
        if (this.isConnected()) void this.disconnect();
      }
    })();
  }

  /**
   * Enters MicroPython raw REPL mode (Ctrl+A).
   * Waits until the board echoes "raw REPL" before resolving.
   */
  private _enterRaw(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._rxHandler = null;
        reject(new Error('Timeout entering raw REPL'));
      }, 5000);
      let buf = '';
      this._rxHandler = (data: Uint8Array) => {
        buf += this._decoder.decode(data, { stream: true });
        if (buf.includes('raw REPL')) {
          clearTimeout(timer);
          this._rxHandler = null;
          resolve();
        }
      };
      void this._writeBytes(new Uint8Array([0x01])); // Ctrl+A
    });
  }

  /**
   * Sends `code` for execution and streams its output to `subject`.
   *
   * Raw REPL protocol after sending `code + \x04`:
   *   board → "OK" (2 bytes) + stdout bytes + \x04 + stderr bytes + \x04
   */
  private _execRaw(code: string, subject: Subject<OutputLine>): Promise<void> {
    return new Promise<void>((resolve) => {
      const encoder = new TextEncoder();
      const codeBytes = encoder.encode(code);
      const packet = new Uint8Array(codeBytes.length + 1);
      packet.set(codeBytes);
      packet[codeBytes.length] = 0x04; // Ctrl+D triggers execution

      let phase: 'ok' | 'stdout' | 'stderr' = 'ok';
      let okBytesLeft = 2;
      let lineBuf = '';

      this._rxHandler = (data: Uint8Array) => {
        for (const byte of data) {
          if (phase === 'ok') {
            if (--okBytesLeft === 0) phase = 'stdout';
          } else if (phase === 'stdout') {
            if (byte === 0x04) {
              if (lineBuf) { subject.next({ text: lineBuf, isError: false }); lineBuf = ''; }
              phase = 'stderr';
            } else if (byte === 0x0a) {
              subject.next({ text: lineBuf, isError: false });
              lineBuf = '';
            } else if (byte !== 0x0d) {
              lineBuf += String.fromCharCode(byte);
            }
          } else {
            if (byte === 0x04) {
              if (lineBuf) { subject.next({ text: lineBuf, isError: true }); lineBuf = ''; }
              this._rxHandler = null;
              resolve();
              return;
            } else if (byte === 0x0a) {
              subject.next({ text: lineBuf, isError: true });
              lineBuf = '';
            } else if (byte !== 0x0d) {
              lineBuf += String.fromCharCode(byte);
            }
          }
        }
      };

      void this._writeBytes(packet);
    });
  }

  /** Exits raw REPL mode (Ctrl+B), returning to the normal interactive REPL. */
  private async _exitRaw(): Promise<void> {
    await this._writeBytes(new Uint8Array([0x02])); // Ctrl+B
  }
}
