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
import { EditorComponent, type SelectionInfo, type CursorInfo } from './editor/editor';
import { ConsoleComponent } from './console/console';
import { ReplComponent } from './repl/repl';
import { DocumentationComponent } from './docs/docs.component';
import { StorageService } from './storage/storage.service';
import { RunnerService } from './runner/runner.service';
import type { OutputLine } from './runner/runner.service';
import { ThemeService } from './theme/theme.service';
import { VirtualKeyboardService } from './virtual-keyboard/virtual-keyboard.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog';
import type { ConfirmDialogData } from './confirm-dialog/confirm-dialog';
import { ReplService } from './repl/repl.service';
import { ShareService } from './share/share.service';
import { ShareDialogComponent } from './share/share-dialog';
import type { ShareDialogData } from './share/share-dialog';
import { PackagesComponent } from './packages/packages';
import { PackagesService } from './packages/packages.service';
import { PackagesDialogComponent } from './packages/packages-dialog';
import { AiSettingsDialogComponent } from './ai-settings-dialog/ai-settings-dialog';
import { AiService } from './ai/ai.service';
import { NewFileDialogComponent } from './new-file-dialog/new-file-dialog';
import { AiPromptDialogComponent } from './ai-prompt-dialog/ai-prompt-dialog';
import type { AiPromptDialogData } from './ai-prompt-dialog/ai-prompt-dialog';
import { BoardService } from './board/board.service';

const DEFAULT_CODE = `# Welcome to PyPad!
print("Hello, PyPad!")
`;

const MIN_RATIO = 0;
const MAX_RATIO = 1;

/** Extracts the 1-based line number from the last "line N" occurrence in a traceback. */
function parseErrorLine(errorLines: string[]): number | null {
  for (let i = errorLines.length - 1; i >= 0; i--) {
    const match = errorLines[i].match(/\bline (\d+)\b/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

export type LayoutMode = 'editor' | 'both' | 'panel';
export type PanelId = 'output' | 'repl' | 'docs';

const PANEL_IDS: PanelId[] = ['output', 'repl', 'docs'];

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
    DocumentationComponent
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
  protected readonly aiService = inject(AiService);
  protected readonly board = inject(BoardService);
  protected readonly hasWebSerial = 'serial' in navigator;
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
  protected readonly outputLines = signal<OutputLine[]>([]);
  protected readonly splitRatio = signal(0.65);
  protected readonly layout = signal<LayoutMode>('both');
  protected readonly activePanelId = signal<PanelId>('output');
  protected readonly activePanelTabIndex = computed(() => PANEL_IDS.indexOf(this.activePanelId()));
  protected readonly cursorInfo = signal<CursorInfo | null>(null);
  protected readonly selection = signal<SelectionInfo | null>(null);
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
        // Open the Packages dialog so the user sees installation progress.
        this.openPackages();
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

  protected onSelectionChange(selection: SelectionInfo): void {
    this.selection.set(selection.text.trim() ? selection : null);
  }

  protected onPanelTabChange(index: number): void {
    this.activePanelId.set(PANEL_IDS[index] ?? 'output');
  }

  protected runCode(): void {
    this.storage.flush();
    this.editorRef().clearErrorHighlight();
    // When the REPL tab is active, run inside the REPL so variables are inspectable.
    if (this.activePanelId() === 'repl') {
      if (this.layout() === 'editor') this.setLayout('both');
      this.replService.runInRepl(this.currentCode());
      return;
    }

    this.outputLines.set([]);
    this.activePanelId.set('output');
    if (this.layout() === 'editor') this.setLayout('both');

    const accumulated: OutputLine[] = [];
    this.runner.run(this.currentCode()).subscribe({
      next: (line) => {
        accumulated.push(line);
        this.outputLines.update((lines) => [...lines, line]);
      },
      complete: () => {
        if (accumulated.length === 0) {
          this.outputLines.set([{ text: '(no output)', isError: false }]);
        }
        const errorLine = parseErrorLine(accumulated.filter((l) => l.isError).map((l) => l.text));
        if (errorLine !== null) this.editorRef().goToLine(errorLine);
      },
    });
  }

  protected stopCode(): void {
    this.runner.stop();
  }

  protected clearOutput(): void {
    this.outputLines.set([]);
    this.editorRef().clearErrorHighlight();
    if (this.board.isConnected()) this.board.softReset();
  }

  protected newFile(): void {
    this.dialog
      .open(NewFileDialogComponent, {
        data: {
          title: 'New file',
          message: 'Your current code will be replaced.',
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (result: { confirmed: boolean; prompt: string } | undefined) => {
        if (!result?.confirmed) return;

        this.sidenavOpen.set(false);

        if (result.prompt) {
          try {
            // Temporarily show a loading state in the output if possible, 
            // or just rely on the fact that it's an async operation.
            const generatedCode = await this.aiService.generateCode(result.prompt);
            this.editorRef().setContent(generatedCode);
          } catch (err) {
            this.dialog.open(ConfirmDialogComponent, {
              data: {
                title: 'AI Generation Failed',
                message: err instanceof Error ? err.message : 'An unknown error occurred',
                confirmLabel: 'OK',
              },
            });
          }
        } else {
          this.editorRef().setContent(DEFAULT_CODE);
        }
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

  protected openAiSettings(): void {
    this.sidenavOpen.set(false);
    this.dialog.open(AiSettingsDialogComponent, {
      width: '440px',
    });
  }

  protected openPackages(): void {
    this.sidenavOpen.set(false);
    this.dialog.open(PackagesDialogComponent, {
      width: '480px',
    });
  }

  protected openAiPrompt(): void {
    if (!this.aiService.hasApiKey()) {
      this.openAiSettings();
      return;
    }

    const currentSelection = this.editorRef().getSelection();
    const isFixMode = !!currentSelection?.text.trim();

    this.dialog
      .open(AiPromptDialogComponent, {
        data: {
          isFixMode,
          selectedText: currentSelection?.text,
        } satisfies AiPromptDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (prompt: string | undefined) => {
        if (!prompt) return;

        try {
          const finalPrompt = isFixMode
            ? `Fix/Modify the following code according to this instruction: "${prompt}"\n\nCode to modify:\n\`\`\`python\n${currentSelection?.text}\n\`\`\``
            : prompt;

          const generatedCode = await this.aiService.generateCode(finalPrompt);
          this.editorRef().insertText(generatedCode);
        } catch (err) {
          this.dialog.open(ConfirmDialogComponent, {
            data: {
              title: isFixMode ? 'AI Fix Failed' : 'AI Insertion Failed',
              message: err instanceof Error ? err.message : 'An unknown error occurred',
              confirmLabel: 'OK',
            },
          });
        }
      });
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
      if (this.runner.isRunning()) this.stopCode();
      else if (this.runner.isReady()) this.runCode();
    } else if (e.key === 'o') {
      e.preventDefault();
      this.openFile();
    } else if (e.key === '\\') {
      e.preventDefault();
      this.openAiPrompt();
    } else if (e.key === '?') {
      e.preventDefault();
      // Ctrl+? (Ctrl+Shift+/ on US keyboards): show the Docs tab and keep editor focus.
      this.activePanelId.set('docs');
      if (this.layout() === 'editor') this.setLayout('both');
      this.editorRef().focus();
    }
  }

  protected async uploadToBoard(): Promise<void> {
    this.sidenavOpen.set(false);
    this.storage.flush();
    this.outputLines.set([]);
    this.activePanelId.set('output');
    if (this.layout() === 'editor') this.setLayout('both');
    try {
      await this.board.uploadFile('main.py', this.currentCode());
      this.board.softReset();
      this.outputLines.set([{ text: 'Uploaded main.py to Pico.', isError: false }]);
    } catch (e) {
      this.outputLines.set([{ text: String(e), isError: true }]);
    }
  }

  protected downloadFromBoard(): void {
    this.sidenavOpen.set(false);
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Download main.py',
          message: 'Your current editor content will be replaced with main.py from the Pico.',
          confirmLabel: 'Download',
        } satisfies ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;
        try {
          const content = await this.board.downloadFile('main.py');
          this.editorRef().setContent(content);
        } catch (e) {
          this.outputLines.set([{ text: String(e), isError: true }]);
          this.activePanelId.set('output');
          if (this.layout() === 'editor') this.setLayout('both');
        }
      });
  }

  protected async clearBoardFile(): Promise<void> {
    this.sidenavOpen.set(false);
    this.outputLines.set([]);
    this.activePanelId.set('output');
    if (this.layout() === 'editor') this.setLayout('both');
    try {
      await this.board.clearFile('main.py');
      this.board.softReset();
      this.outputLines.set([{ text: 'Cleared main.py on Pico.', isError: false }]);
    } catch (e) {
      this.outputLines.set([{ text: String(e), isError: true }]);
    }
  }

  protected async connectBoard(): Promise<void> {
    if (this.board.isConnected()) {
      await this.board.disconnect();
    } else {
      await this.board.connect();
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
