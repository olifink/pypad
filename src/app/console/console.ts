import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-console',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './console.html',
  styleUrl: './console.css',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  host: { class: 'app-console' },
})
export class ConsoleComponent {
  readonly lines = input<string[]>([]);
  readonly clear = output<void>();
}
