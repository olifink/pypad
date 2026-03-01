import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './console.html',
  styleUrl: './console.css',
  host: { class: 'app-console' },
})
export class ConsoleComponent {
  readonly lines = input<string[]>([]);
}
