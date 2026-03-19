/// <reference lib="webworker" />

import type { ProjectModuleMap } from '../projects/project.service';

type InMsg =
  | { type: 'init'; baseUrl: string }
  | { type: 'run'; code: string; projectModules?: ProjectModuleMap }
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
_original_import = builtins.__import__
_project_modules = {}

class _ProjectModule:
    pass

def _clear_project_modules():
    global _project_modules
    for name in list(_project_modules):
        if name in sys.modules:
            del sys.modules[name]
    _project_modules = {}

def _set_project_modules(modules):
    _clear_project_modules()
    _project_modules.update(modules)

def _load_project_module(name):
    cached = sys.modules.get(name)
    if cached is not None:
        if getattr(cached, '__pypad_loading__', False):
            raise ImportError("Circular project imports are not supported: " + name)
        return cached

    code = _project_modules.get(name)
    if code is None:
        raise ImportError("No module named '" + name + "'")

    module = _ProjectModule()
    module.__name__ = name
    module.__file__ = name + '.py'
    module.__package__ = ''
    module.__pypad_loading__ = True
    sys.modules[name] = module
    module_globals = {
        '__name__': name,
        '__file__': name + '.py',
        '__package__': '',
    }

    try:
        exec(code, module_globals)
        for attr_name in module_globals:
            setattr(module, attr_name, module_globals[attr_name])
        del module.__pypad_loading__
        return module
    except Exception:
        if name in sys.modules:
            del sys.modules[name]
        raise

def _project_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level != 0:
        return _original_import(name, globals, locals, fromlist, level)

    root_name = name.split('.', 1)[0]
    if root_name not in _project_modules:
        return _original_import(name, globals, locals, fromlist, level)

    return _load_project_module(root_name)

builtins.__import__ = _project_import

def _pypad_run(code, project_modules):
    def _print(*args, **kwargs):
        sep = kwargs.get('sep', ' ')
        end = kwargs.get('end', '\\n')
        text = sep.join(str(a) for a in args) + end
        lines = text.split('\\n')
        if lines and lines[-1] == '':
            lines.pop()
        for line in lines:
            js.globalThis._pypadLine(line, False)

    original_print = builtins.print
    builtins.print = _print
    _set_project_modules(project_modules)

    try:
        exec(code, {'__name__': '__main__', '__file__': '__main__.py'})
    except Exception as e:
        buf = io.StringIO()
        sys.print_exception(e, buf)
        err_text = buf.getvalue()
        for line in err_text.strip().split('\\n'):
            js.globalThis._pypadLine(line, True)
    finally:
        builtins.print = original_print
        _clear_project_modules()

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
      interpreter.runPython(
        `_pypad_run(${JSON.stringify(msg.code)}, ${JSON.stringify(msg.projectModules ?? {})})`,
      );
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
