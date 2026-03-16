import { Injectable, inject, signal } from '@angular/core';
import { RunnerService } from '../runner/runner.service';

export interface InstalledPackage {
  name: string;
}

@Injectable({ providedIn: 'root' })
export class PackagesService {
  private readonly runner = inject(RunnerService);

  /** Packages installed in the current session (lost on page reload). */
  readonly installedPackages = signal<InstalledPackage[]>([]);

  /** True while a mip.install() call is in progress. */
  readonly isInstalling = signal(false);

  /** stdout captured from the last install operation. */
  readonly lastLog = signal<string | null>(null);

  /**
   * Installs `name` via `mip.install()` in the runner worker.
   *
   * @param silent - When true, suppresses updates to `isInstalling` / `lastLog`.
   *                 Used during REPL reset to reinstall silently in the background.
   */
  async install(name: string, silent = false): Promise<{ success: boolean; log: string }> {
    if (!silent) this.isInstalling.set(true);
    try {
      const result = await this.runner.install(name);
      if (!result.success) {
        if (!silent) this.lastLog.set(result.log);
        return result;
      }
      if (!silent) this.lastLog.set(`Installed ${name}.`);
      if (!this.installedPackages().some((p) => p.name === name)) {
        this.installedPackages.update((pkgs) => [...pkgs, { name }]);
      }
      return result;
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
