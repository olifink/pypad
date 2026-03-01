import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EditorComponent } from './editor/editor';
import { ConsoleComponent } from './console/console';

const DEFAULT_CODE = `# Welcome to PyPad!
print("Hello, PyPad!")
`;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, EditorComponent, ConsoleComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly initialCode = DEFAULT_CODE;
  protected readonly outputLines = signal<string[]>([]);

  protected onCodeChange(_code: string): void {
    // Code is owned by EditorComponent; received here for future RunnerService use.
  }

  protected runCode(): void {
    // RunnerService will be wired here (Phase 1 — MicroPython bridge).
    this.outputLines.set(['[Run not yet implemented — PyScript bridge coming next]']);
  }
}
