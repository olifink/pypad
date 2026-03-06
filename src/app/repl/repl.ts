import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ReplService } from './repl.service';

@Component({
  selector: 'app-repl',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './repl.html',
  styleUrl: './repl.css',
  host: { class: 'app-repl' },
})
export class ReplComponent implements AfterViewInit, OnDestroy {
  readonly isDark = input(false);

  protected readonly replService = inject(ReplService);

  private readonly terminalRef = viewChild.required<ElementRef<HTMLElement>>('terminal');
  private started = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Keep the terminal theme in sync with the app's dark/light mode.
    effect(() => {
      this.replService.setTheme(this.isDark());
    });
  }

  ngAfterViewInit(): void {
    if (this.started) return;
    this.started = true;

    const hostEl = this.terminalRef().nativeElement;

    const init = async () => {
      await this.replService.startRepl(hostEl, this.isDark());
      // Keep the terminal sized to its container whenever the panel resizes.
      this.resizeObserver = new ResizeObserver(() => {
        this.replService.fitAddon?.fit();
      });
      this.resizeObserver.observe(hostEl);
    };

    if (this.replService.isReady()) {
      void init();
    } else {
      // Wait for the runtime to become available, then initialise.
      const id = setInterval(() => {
        if (this.replService.isReady()) {
          clearInterval(id);
          void init();
        }
      }, 200);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
