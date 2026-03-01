import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorComponent } from './editor/editor';
import { ConsoleComponent } from './console/console';
import { StorageService } from './storage/storage.service';
import { RunnerService } from './runner/runner.service';
import { ThemeService } from './theme/theme.service';

const DEFAULT_CODE = `# Welcome to PyPad!
print("Hello, PyPad!")
`;

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    EditorComponent,
    ConsoleComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly storage = inject(StorageService);
  protected readonly runner = inject(RunnerService);
  protected readonly theme = inject(ThemeService);

  protected readonly themeIcon = computed(() => {
    const icons = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' } as const;
    return icons[this.theme.mode()];
  });

  protected readonly themeTooltip = computed(() => {
    const labels = {
      light: 'Light mode — click for dark',
      dark: 'Dark mode — click for system',
      system: 'System theme — click for light',
    } as const;
    return labels[this.theme.mode()];
  });

  private readonly workspaceRef = viewChild.required<ElementRef<HTMLElement>>('workspace');

  protected readonly initialCode = this.storage.load() ?? DEFAULT_CODE;
  protected readonly outputLines = signal<string[]>([]);
  protected readonly splitRatio = signal(0.65);
  private readonly currentCode = signal(this.initialCode);

  protected onCodeChange(code: string): void {
    this.currentCode.set(code);
    this.storage.save(code);
  }

  protected runCode(): void {
    const lines = this.runner.run(this.currentCode());
    this.outputLines.set(lines);
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
