import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { EditorComponent } from './editor/editor';
import type { CursorInfo } from './editor/editor';
import { ConsoleComponent } from './console/console';
import { ReplComponent } from './repl/repl';
import { DocumentationComponent } from './docs/docs.component';
import { StorageService } from './storage/storage.service';
import { RunnerService } from './runner/runner.service';
import { ThemeService } from './theme/theme.service';
import { VirtualKeyboardService } from './virtual-keyboard/virtual-keyboard.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog';
import { ReplService } from './repl/repl.service';
import { ShareService } from './share/share.service';
import { ShareDialogComponent } from './share/share-dialog';
import type { ShareDialogData } from './share/share-dialog';
import { PackagesComponent } from './packages/packages';
import { PackagesService } from './packages/packages.service';

const DEFAULT_CODE = `# Welcome to PyPad!
print("Hello, PyPad!")
`;

const MIN_RATIO = 0;
const MAX_RATIO = 1;

export type LayoutMode = 'editor' | 'both' | 'panel';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatIconModule,
    MatSidenavModule,
    MatTooltipModule,
    MatTabsModule,
    EditorComponent,
    ConsoleComponent,
    ReplComponent,
    DocumentationComponent,
    PackagesComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(document:keydown)': 'onKeyDown($event)',
  },
})
export class App {
  private readonly storage = inject(StorageService);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);
  private readonly shareService = inject(ShareService);
  protected readonly runner = inject(RunnerService);
  protected readonly replService = inject(ReplService);
  protected readonly theme = inject(ThemeService);
  protected readonly packagesService = inject(PackagesService);
  private readonly _vk = inject(VirtualKeyboardService);

  private readonly workspaceRef = viewChild.required<ElementRef<HTMLElement>>('workspace');
  private readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly editorRef = viewChild.required(EditorComponent);

  /** Packages bundled in the share URL, queued for auto-install once the interpreter is ready. */
  private _sharedPackages: string[] = [];

  protected readonly initialCode = (() => {
    const shared = this.shareService.getSharedCode();
    if (shared) {
      // Persist immediately so a subsequent reload uses localStorage, not the URL.
      this.storage.save(shared.code);
      this._sharedPackages = shared.packages;
      return shared.code;
    }
    return this.storage.load() ?? DEFAULT_CODE;
  })();
  protected readonly sidenavOpen = signal(false);
  protected readonly outputLines = signal<string[]>([]);
  protected readonly splitRatio = signal(0.65);
  protected readonly layout = signal<LayoutMode>('both');
  protected readonly activePanelTab = signal(0);
  protected readonly cursorInfo = signal<CursorInfo | null>(null);
  private readonly currentCode = signal(this.initialCode);

  constructor() {
    // Strip ?s= after Angular's router has completed its initial navigation,
    // which may overwrite any earlier history.replaceState call.
    afterNextRender(() => this.shareService.stripShareParam());

    // Auto-install packages bundled in a share URL once the interpreter is ready.
    effect(() => {
      if (this.runner.isReady() && this._sharedPackages.length > 0) {
        const pkgs = this._sharedPackages.splice(0);
        void Promise.all(pkgs.map((p) => this.packagesService.install(p)));
        // Switch to Packages tab so the user sees install progress.
        this.activePanelTab.set(3);
        if (this.layout() === 'editor') this.setLayout('both');
      }
    });
  }

  protected readonly showEditor = computed(
    () => this.layout() === 'editor' || this.layout() === 'both',
  );
  protected readonly showPanel = computed(
    () => this.layout() === 'panel' || this.layout() === 'both',
  );
  protected readonly showDivider = computed(() => this.layout() === 'both');

  protected setLayout(mode: LayoutMode): void {
    this.layout.set(mode);
    if (mode === 'editor') this.splitRatio.set(1);
    else if (mode === 'panel') this.splitRatio.set(0);
    else this.splitRatio.set(0.65);
  }

  protected onCodeChange(code: string): void {
    this.currentCode.set(code);
    this.storage.save(code);
  }

  protected onCursorChange(info: CursorInfo): void {
    this.cursorInfo.set(info);
  }

  protected runCode(): void {
    this.storage.flush();
    // When the REPL tab is active, run inside the REPL so variables are inspectable.
    if (this.activePanelTab() === 2) {
      if (this.layout() === 'editor') this.setLayout('both');
      this.replService.runInRepl(this.currentCode());
      return;
    }
    const lines = this.runner.run(this.currentCode());
    this.outputLines.set(lines);
    this.activePanelTab.set(0);
    // Switch to 'both' so the user sees the output.
    if (this.layout() === 'editor') this.setLayout('both');
  }

  protected newFile(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'New file',
          message: 'Your current code will be replaced.',
          confirmLabel: 'New file',
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.editorRef().setContent(DEFAULT_CODE);
        this.sidenavOpen.set(false);
      });
  }

  protected downloadCode(): void {
    const blob = new Blob([this.currentCode()], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = 'main.py';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected shareCode(): void {
    this.dialog.open(ShareDialogComponent, {
      data: {
        code: this.currentCode(),
        packages: this.packagesService.installedPackages().map((p) => p.name),
      } satisfies ShareDialogData,
      width: '480px',
    });
  }

  protected openFile(): void {
    this.sidenavOpen.set(false);
    this.fileInputRef().nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.editorRef().setContent(reader.result as string);
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    if (e.key === 's') {
      e.preventDefault();
      this.storage.flush();
    } else if (e.key === 'r') {
      e.preventDefault();
      if (this.runner.isReady()) this.runCode();
    } else if (e.key === 'o') {
      e.preventDefault();
      this.openFile();
    } else if (e.key === '?') {
      e.preventDefault();
      // Ctrl+? (Ctrl+Shift+/ on US keyboards): show the Docs tab and keep editor focus.
      this.activePanelTab.set(1);
      if (this.layout() === 'editor') this.setLayout('both');
      this.editorRef().focus();
    }
  }

  protected onDividerPointerDown(e: PointerEvent): void {
    e.preventDefault();
    const workspace = this.workspaceRef().nativeElement;

    const onMove = (ev: PointerEvent): void => {
      const rect = workspace.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top) / rect.height;
      this.splitRatio.set(Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO));
    };

    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
}
