import { Injectable, DOCUMENT, inject, signal } from '@angular/core';

export interface InstalledPackage {
  name: string;
}

declare global {
  interface Window {
    pypad_install_status?: string;
    pypad_install_log?: string;
  }
}

/**
 * Builds a Python script that installs `name` via mip, captures stdout using
 * StringIO (mip uses Python-level print()), and exports the log + status to
 * window globals so TypeScript can read them back after runPython() returns.
 */
function buildInstallScript(name: string): string {
  // JSON.stringify ensures the name is properly escaped as a Python string literal.
  const pyName = JSON.stringify(name);
  return `import sys, io, js
_buf = io.StringIO()
_old = sys.stdout
sys.stdout = _buf
try:
    import mip
    mip.install(${pyName})
    js.globalThis.pypad_install_status = "ok"
except Exception as e:
    js.globalThis.pypad_install_status = "error:" + repr(e)
finally:
    sys.stdout = _old
js.globalThis.pypad_install_log = _buf.getvalue()`.trim();
}

@Injectable({ providedIn: 'root' })
export class PackagesService {
  private readonly doc = inject(DOCUMENT);

  /** Packages installed in the current session (lost on page reload). */
  readonly installedPackages = signal<InstalledPackage[]>([]);

  /** True while a mip.install() call is in progress. */
  readonly isInstalling = signal(false);

  /** stdout captured from the last install operation. */
  readonly lastLog = signal<string | null>(null);

  /**
   * Installs `name` via `mip.install()` on the current interpreter.
   *
   * @param silent - When true, suppresses updates to `isInstalling` / `lastLog`.
   *                 Used during REPL reset to reinstall silently in the background.
   */
  async install(name: string, silent = false): Promise<{ success: boolean; log: string }> {
    const win = this.doc.defaultView as Window;
    const interpreter = win.pypad_interpreter;
    if (!interpreter) {
      const msg = 'Interpreter not ready.';
      if (!silent) this.lastLog.set(msg);
      return { success: false, log: msg };
    }

    if (!silent) this.isInstalling.set(true);
    try {
      // Yield to let Angular render the loading state before runPython() blocks.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      win.pypad_install_status = undefined;
      win.pypad_install_log = undefined;
      interpreter.runPython(buildInstallScript(name));

      const log = win.pypad_install_log ?? '';
      // Explicit string annotation prevents TypeScript narrowing status to "" after the reset above.
      const status: string = win.pypad_install_status ?? '';
      const success = status === 'ok';

      if (!silent) {
        this.lastLog.set(
          log.trim() || (success ? `Installed ${name}.` : status.replace(/^error:/, '')),
        );
      }

      if (success && !this.installedPackages().some((p) => p.name === name)) {
        this.installedPackages.update((pkgs) => [...pkgs, { name }]);
      }
      return { success, log };
    } finally {
      if (!silent) this.isInstalling.set(false);
    }
  }

  /** Removes a package from the tracking list (does not uninstall from WASM fs). */
  remove(name: string): void {
    this.installedPackages.update((pkgs) => pkgs.filter((p) => p.name !== name));
  }

  /**
   * Re-installs every tracked package on the current interpreter.
   * Called after a REPL reset so that all packages remain available.
   */
  async reinstallAll(): Promise<void> {
    for (const pkg of this.installedPackages()) {
      await this.install(pkg.name, true);
    }
  }
}
