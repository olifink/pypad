import { Injectable, DOCUMENT, inject, signal } from '@angular/core';

export interface InstalledPackage {
  name: string;
}

/**
 * Builds a minimal Python script that installs `name` via mip.
 * Errors propagate as JS exceptions from runPython(), caught by the caller.
 */
function buildInstallScript(name: string): string {
  const pyName = JSON.stringify(name);
  return `import mip\nmip.install(${pyName})`;
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

      try {
        interpreter.runPython(buildInstallScript(name));
      } catch (e) {
        // Python raised an exception — runPython re-throws it as a JS error.
        const msg = e instanceof Error ? e.message : String(e);
        if (!silent) this.lastLog.set(msg);
        return { success: false, log: msg };
      }

      // If runPython didn't throw, the install succeeded.
      if (!silent) this.lastLog.set(`Installed ${name}.`);
      if (!this.installedPackages().some((p) => p.name === name)) {
        this.installedPackages.update((pkgs) => [...pkgs, { name }]);
      }
      return { success: true, log: '' };
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
