import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  ElementRef,
  computed,
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
  protected readonly runner = inject(RunnerService);
  protected readonly theme = inject(ThemeService);
  private readonly _vk = inject(VirtualKeyboardService);

  private readonly workspaceRef = viewChild.required<ElementRef<HTMLElement>>('workspace');
  private readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly editorRef = viewChild.required(EditorComponent);

  protected readonly initialCode = this.storage.load() ?? DEFAULT_CODE;
  protected readonly sidenavOpen = signal(false);
  protected readonly outputLines = signal<string[]>([]);
  protected readonly splitRatio = signal(0.65);
  protected readonly layout = signal<LayoutMode>('both');
  protected readonly activePanelTab = signal(0);
  protected readonly cursorInfo = signal<CursorInfo | null>(null);
  private readonly currentCode = signal(this.initialCode);

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
