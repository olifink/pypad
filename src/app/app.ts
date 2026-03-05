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
import { EditorComponent } from './editor/editor';
import { ConsoleComponent } from './console/console';
import { StorageService } from './storage/storage.service';
import { RunnerService } from './runner/runner.service';
import { ThemeService } from './theme/theme.service';
import { VirtualKeyboardService } from './virtual-keyboard/virtual-keyboard.service';

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
  protected readonly runner = inject(RunnerService);
  protected readonly theme = inject(ThemeService);
  private readonly _vk = inject(VirtualKeyboardService);

  private readonly workspaceRef = viewChild.required<ElementRef<HTMLElement>>('workspace');

  protected readonly initialCode = this.storage.load() ?? DEFAULT_CODE;
  protected readonly sidenavOpen = signal(false);
  protected readonly outputLines = signal<string[]>([]);
  protected readonly splitRatio = signal(0.65);
  protected readonly layout = signal<LayoutMode>('both');
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

  protected runCode(): void {
    this.storage.flush();
    const lines = this.runner.run(this.currentCode());
    this.outputLines.set(lines);
    // Switch to 'both' so the user sees the output.
    if (this.layout() === 'editor') this.setLayout('both');
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

  protected onKeyDown(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;

    if (e.key === 's') {
      e.preventDefault();
      this.storage.flush();
    } else if (e.key === 'r') {
      e.preventDefault();
      if (this.runner.isReady()) this.runCode();
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
