/// <reference lib="webworker" />

type InMsg =
  | { type: 'init'; baseUrl: string }
  | { type: 'run'; code: string }
  | { type: 'install'; name: string; id: string };

type OutMsg =
  | { type: 'ready' }
  | { type: 'line'; text: string; isError: boolean }
  | { type: 'done' }
  | { type: 'install_result'; id: string; success: boolean; log: string };

/** Options accepted by `loadMicroPython` from `micropython.mjs`. */
interface LoadMicroPythonOptions {
  stdout?: (data: Uint8Array) => void;
  stderr?: (data: Uint8Array) => void;
  linebuffer?: boolean;
  heapsize?: number;
  pystack?: number;
  url?: string;
}

interface MicroPythonInterpreter {
  runPython(code: string): string;
}

/**
 * Python setup code run once after the interpreter loads.
 * Registers `_pypad_run(code)` which streams output line-by-line via JS globals,
 * and overrides `input()` to raise a clear error.
 */
const SETUP_PYTHON = `
import js, sys, io, builtins

def _input(prompt=''):
    raise OSError("input() is not supported in the Output tab. Use the REPL tab for interactive programs.")

builtins.input = _input

def _pypad_run(code):
    def _print(*args, **kwargs):
        sep = kwargs.get('sep', ' ')
        end = kwargs.get('end', '\\n')
        text = sep.join(str(a) for a in args) + end
        lines = text.split('\\n')
        if lines and lines[-1] == '':
            lines.pop()
        for line in lines:
            js.globalThis._pypadLine(line, False)

    try:
        exec(code, {'__name__': '__main__', 'print': _print})
    except Exception as e:
        buf = io.StringIO()
        sys.print_exception(e, buf)
        err_text = buf.getvalue()
        for line in err_text.strip().split('\\n'):
            js.globalThis._pypadLine(line, True)

    js.globalThis._pypadDone()
`.trim();

let interpreter: MicroPythonInterpreter | null = null;

(self as unknown as Worker).addEventListener('message', async (e: MessageEvent<InMsg>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      const mpjsUrl = new URL('pyscript/micropython/micropython.mjs', msg.baseUrl).href;
      const { loadMicroPython } = (await import(/* @vite-ignore */ mpjsUrl)) as {
        loadMicroPython: (options: LoadMicroPythonOptions) => Promise<MicroPythonInterpreter>;
      };

      interpreter = await loadMicroPython({ linebuffer: false });

      // Register JS callbacks that Python will invoke during execution.
      (self as any)._pypadLine = (text: string, isError: boolean) =>
        self.postMessage({ type: 'line', text, isError } satisfies OutMsg);
      (self as any)._pypadDone = () =>
        self.postMessage({ type: 'done' } satisfies OutMsg);

      interpreter.runPython(SETUP_PYTHON);
      self.postMessage({ type: 'ready' } satisfies OutMsg);
    } catch (err) {
      // Post a line so the UI shows something meaningful if init fails.
      self.postMessage({
        type: 'line',
        text: `Failed to load MicroPython: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      } satisfies OutMsg);
      self.postMessage({ type: 'done' } satisfies OutMsg);
    }
    return;
  }

  if (msg.type === 'run') {
    if (!interpreter) {
      self.postMessage({ type: 'line', text: 'Runtime not ready.', isError: true } satisfies OutMsg);
      self.postMessage({ type: 'done' } satisfies OutMsg);
      return;
    }
    try {
      interpreter.runPython(`_pypad_run(${JSON.stringify(msg.code)})`);
    } catch (err) {
      // Safety net: JS-level exceptions (shouldn't normally happen as Python catches them).
      self.postMessage({
        type: 'line',
        text: err instanceof Error ? err.message : String(err),
        isError: true,
      } satisfies OutMsg);
      self.postMessage({ type: 'done' } satisfies OutMsg);
    }
    return;
  }

  if (msg.type === 'install') {
    if (!interpreter) {
      self.postMessage({
        type: 'install_result',
        id: msg.id,
        success: false,
        log: 'Runtime not ready.',
      } satisfies OutMsg);
      return;
    }
    try {
      interpreter.runPython(`import mip\nmip.install(${JSON.stringify(msg.name)})`);
      self.postMessage({
        type: 'install_result',
        id: msg.id,
        success: true,
        log: `Installed ${msg.name}.`,
      } satisfies OutMsg);
    } catch (err) {
      self.postMessage({
        type: 'install_result',
        id: msg.id,
        success: false,
        log: err instanceof Error ? err.message : String(err),
      } satisfies OutMsg);
    }
  }
});
