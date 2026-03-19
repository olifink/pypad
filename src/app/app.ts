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
import { ProjectService } from './projects/project.service';
import { TextPromptDialogComponent } from './text-prompt-dialog/text-prompt-dialog';
import type { TextPromptDialogData } from './text-prompt-dialog/text-prompt-dialog';

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
interface NewFileDialogResult {
  confirmed: boolean;
  name?: string;
  prompt: string;
}

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
  protected readonly projects = inject(ProjectService);
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
  protected readonly availableProjects = this.projects.availableProjects;
  protected readonly projectFiles = this.projects.projectFiles;
  protected readonly isProjectOpen = this.projects.isProjectOpen;
  protected readonly activeProjectName = this.projects.activeProjectName;
  protected readonly activeFileName = computed(() => this.projects.activeFileName() ?? 'main.py');
  protected readonly otherProjects = computed(() =>
    this.availableProjects().filter((projectName) => projectName !== this.activeProjectName()),
  );
  private readonly currentCode = signal(this.initialCode);

  constructor() {
    afterNextRender(() => this.shareService.stripShareParam());
    afterNextRender(() => void this.restoreProjectDocument());

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

  private async restoreProjectDocument(): Promise<void> {
    const snapshot = await this.projects.restoreActiveProject();
    if (!snapshot) return;
    this.editorRef().setContent(snapshot.code);
    this.currentCode.set(snapshot.code);
  }

  private async flushActiveDocument(): Promise<void> {
    this.storage.flush();
    await this.projects.flush();
  }

  private showErrorDialog(title: string, error: unknown): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
        confirmLabel: 'OK',
      },
    });
  }

  private nextProjectFileName(): string {
    const files = new Set(this.projectFiles());
    if (!files.has('main.py')) return 'main.py';

    let index = 1;
    while (files.has(`untitled-${index}.py`)) index++;
    return `untitled-${index}.py`;
  }

  protected setLayout(mode: LayoutMode): void {
    this.layout.set(mode);
    if (mode === 'editor') this.splitRatio.set(1);
    else if (mode === 'panel') this.splitRatio.set(0);
    else this.splitRatio.set(0.65);
  }

  protected onCodeChange(code: string): void {
    this.currentCode.set(code);
    if (this.isProjectOpen()) {
      this.projects.queueSaveActiveFile(code);
    } else {
      this.storage.save(code);
    }
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

  protected async runCode(): Promise<void> {
    await this.flushActiveDocument();
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

  protected createProject(): void {
    this.dialog
      .open(TextPromptDialogComponent, {
        data: {
          title: 'Create project',
          label: 'Project name',
          confirmLabel: 'Create',
          placeholder: 'my-project',
          hint: 'Project names cannot contain slashes.',
        } satisfies TextPromptDialogData,
        width: '440px',
      })
      .afterClosed()
      .subscribe(async (projectName: string | undefined) => {
        if (!projectName) return;

        try {
          const snapshot = await this.projects.createProject(projectName, this.currentCode());
          this.editorRef().setContent(snapshot.code);
          this.currentCode.set(snapshot.code);
          this.sidenavOpen.set(false);
        } catch (error) {
          this.showErrorDialog('Create Project Failed', error);
        }
      });
  }

  protected openProject(projectName: string): void {
    void this.loadProject(projectName);
  }

  protected closeProject(): void {
    void this.closeProjectInternal();
  }

  protected deleteProject(): void {
    const activeProjectName = this.activeProjectName();
    if (!activeProjectName) return;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Delete ${activeProjectName}?`,
          message: `Delete the project "${activeProjectName}" and all of its browser-local files? This cannot be undone.`,
          confirmLabel: 'Delete',
        } satisfies ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;

        try {
          const deletedProjectName = await this.projects.deleteActiveProject();
          const code = this.storage.load() ?? DEFAULT_CODE;
          this.editorRef().setContent(code);
          this.currentCode.set(code);
          this.sidenavOpen.set(false);
          this.outputLines.set([
            { text: `Deleted project ${deletedProjectName}.`, isError: false },
          ]);
        } catch (error) {
          this.showErrorDialog('Delete Project Failed', error);
        }
      });
  }

  protected renameProject(): void {
    const activeProjectName = this.activeProjectName();
    if (!activeProjectName) return;

    this.dialog
      .open(TextPromptDialogComponent, {
        data: {
          title: 'Rename project',
          label: 'Project name',
          confirmLabel: 'Rename',
          initialValue: activeProjectName,
          hint: 'Project names cannot contain slashes.',
        } satisfies TextPromptDialogData,
        width: '440px',
      })
      .afterClosed()
      .subscribe(async (nextProjectName: string | undefined) => {
        if (!nextProjectName) return;

        try {
          await this.projects.renameActiveProject(nextProjectName);
          this.sidenavOpen.set(false);
        } catch (error) {
          this.showErrorDialog('Rename Project Failed', error);
        }
      });
  }

  protected openProjectFile(fileName: string): void {
    void this.loadProjectFile(fileName);
  }

  protected deleteProjectFile(fileName: string): void {
    const isLastFile = this.projectFiles().length === 1;

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Delete ${fileName}?`,
          message: isLastFile
            ? `Delete ${fileName}? Because it is the last file in the project, PyPad will create a new empty main.py so the project stays usable.`
            : `Delete ${fileName} from this project?`,
          confirmLabel: 'Delete',
        } satisfies ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;

        try {
          const snapshot = await this.projects.deleteFile(fileName);
          this.editorRef().setContent(snapshot.code);
          this.currentCode.set(snapshot.code);
          this.outputLines.set([
            {
              text: isLastFile
                ? `Deleted ${fileName}. Created a new empty ${snapshot.fileName}.`
                : `Deleted ${fileName}.`,
              isError: false,
            },
          ]);
        } catch (error) {
          this.showErrorDialog('Delete File Failed', error);
        }
      });
  }

  protected renameProjectFile(): void {
    const activeFileName = this.projects.activeFileName();
    if (!activeFileName) return;

    this.dialog
      .open(TextPromptDialogComponent, {
        data: {
          title: 'Rename file',
          label: 'File name',
          confirmLabel: 'Rename',
          initialValue: activeFileName,
          hint: 'File names cannot contain slashes.',
        } satisfies TextPromptDialogData,
        width: '440px',
      })
      .afterClosed()
      .subscribe(async (nextFileName: string | undefined) => {
        if (!nextFileName) return;

        try {
          const renamedFileName = await this.projects.renameActiveFile(nextFileName);
          this.currentCode.set(this.currentCode());
          this.sidenavOpen.set(false);
          if (renamedFileName !== activeFileName) {
            this.outputLines.set([
              { text: `Renamed file to ${renamedFileName}.`, isError: false },
            ]);
          }
        } catch (error) {
          this.showErrorDialog('Rename File Failed', error);
        }
      });
  }

  protected newFile(): void {
    this.dialog
      .open(NewFileDialogComponent, {
        data: {
          title: 'New file',
          message: this.isProjectOpen()
            ? 'Create a new file in the active project.'
            : 'Your current code will be replaced.',
          requireName: this.isProjectOpen(),
          initialName: this.isProjectOpen() ? this.nextProjectFileName() : undefined,
          nameHint: this.isProjectOpen() ? 'Files are stored in the active project.' : undefined,
        },
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (result: NewFileDialogResult | undefined) => {
        if (!result?.confirmed) return;

        try {
          const code = result.prompt
            ? await this.aiService.generateCode(result.prompt)
            : this.isProjectOpen()
              ? ''
              : DEFAULT_CODE;

          if (this.isProjectOpen()) {
            const snapshot = await this.projects.createFile(result.name ?? 'main.py', code);
            this.editorRef().setContent(snapshot.code);
            this.currentCode.set(snapshot.code);
          } else {
            this.editorRef().setContent(code);
            this.currentCode.set(code);
          }

          this.sidenavOpen.set(false);
        } catch (error) {
          this.showErrorDialog('New File Failed', error);
        }
      });
  }

  protected downloadCode(): void {
    const blob = new Blob([this.currentCode()], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = this.document.createElement('a');
    a.href = url;
    a.download = this.activeFileName();
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

  private async loadProject(projectName: string): Promise<void> {
    try {
      const snapshot = await this.projects.openProject(projectName);
      this.editorRef().setContent(snapshot.code);
      this.currentCode.set(snapshot.code);
      this.sidenavOpen.set(false);
    } catch (error) {
      this.showErrorDialog('Open Project Failed', error);
    }
  }

  private async closeProjectInternal(): Promise<void> {
    try {
      await this.projects.closeProject();
      const code = this.storage.load() ?? DEFAULT_CODE;
      this.editorRef().setContent(code);
      this.currentCode.set(code);
      this.sidenavOpen.set(false);
    } catch (error) {
      this.showErrorDialog('Close Project Failed', error);
    }
  }

  private async loadProjectFile(fileName: string): Promise<void> {
    try {
      const snapshot = await this.projects.openFile(fileName);
      this.editorRef().setContent(snapshot.code);
      this.currentCode.set(snapshot.code);
      this.sidenavOpen.set(false);
    } catch (error) {
      this.showErrorDialog('Open File Failed', error);
    }
  }

  private async importFileIntoProject(fileName: string, code: string): Promise<void> {
    try {
      const snapshot = await this.projects.writeImportedFile(fileName, code);
      this.editorRef().setContent(snapshot.code);
      this.currentCode.set(snapshot.code);
    } catch (error) {
      this.showErrorDialog('Import File Failed', error);
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const code = typeof reader.result === 'string' ? reader.result : '';
      if (this.isProjectOpen()) {
        void this.importFileIntoProject(file.name, code);
      } else {
        this.editorRef().setContent(code);
        this.currentCode.set(code);
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    if (e.key === 's') {
      e.preventDefault();
      void this.flushActiveDocument();
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
    await this.flushActiveDocument();
    this.outputLines.set([]);
    this.activePanelId.set('output');
    if (this.layout() === 'editor') this.setLayout('both');
    const fileName = this.activeFileName();
    try {
      await this.board.uploadFile(fileName, this.currentCode());
      this.board.softReset();
      this.outputLines.set([{ text: `Uploaded ${fileName} to Pico.`, isError: false }]);
    } catch (e) {
      this.outputLines.set([{ text: String(e), isError: true }]);
    }
  }

  protected downloadFromBoard(): void {
    this.sidenavOpen.set(false);
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Download ${this.activeFileName()}`,
          message: `Your current editor content will be replaced with ${this.activeFileName()} from the Pico.`,
          confirmLabel: 'Download',
        } satisfies ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;
        const fileName = this.activeFileName();
        try {
          const content = await this.board.downloadFile(fileName);
          this.editorRef().setContent(content);
          this.currentCode.set(content);
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
    const fileName = this.activeFileName();
    try {
      await this.board.clearFile(fileName);
      this.board.softReset();
      this.outputLines.set([{ text: `Cleared ${fileName} on Pico.`, isError: false }]);
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
