import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EditorComponent } from './editor/editor';
import { ConsoleComponent } from './console/console';
import { StorageService } from './storage/storage.service';
import { RunnerService } from './runner/runner.service';

const DEFAULT_CODE = `# Welcome to PyPad!
print("Hello, PyPad!")
`;

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

  protected readonly initialCode = this.storage.load() ?? DEFAULT_CODE;
  protected readonly outputLines = signal<string[]>([]);
  private readonly currentCode = signal(this.initialCode);

  protected onCodeChange(code: string): void {
    this.currentCode.set(code);
    this.storage.save(code);
  }

  protected runCode(): void {
    const lines = this.runner.run(this.currentCode());
    this.outputLines.set(lines);
  }
}
