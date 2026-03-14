import { Component, ChangeDetectionStrategy, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { OutputLine } from '../runner/runner.service';

@Component({
  selector: 'app-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './console.html',
  styleUrl: './console.css',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: { class: 'app-console' },
})
export class ConsoleComponent {
  readonly lines = input<OutputLine[]>([]);
  readonly clear = output<void>();

  private readonly outputEl = viewChild<ElementRef<HTMLElement>>('output');

  constructor() {
    effect(() => {
      const lines = this.lines();
      if (lines.length === 0) return;
      const el = this.outputEl()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }
}
