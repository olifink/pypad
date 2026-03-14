import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentationService } from './docs.service';
import { EditorContextService } from './editor-context.service';
import type { CursorInfo } from '../editor/editor';
import { MarkdownComponent } from '../markdown/markdown.component';

@Component({
  selector: 'app-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.css',
  imports: [MarkdownComponent, MatButtonModule, MatIconModule, MatTooltipModule],
})
export class DocumentationComponent {
  readonly cursorInfo = input<CursorInfo | null>(null);

  protected readonly docsService = inject(DocumentationService);
  private readonly editorContext = inject(EditorContextService);

  private readonly debouncedCursor = toSignal(
    toObservable(this.cursorInfo).pipe(debounceTime(300)),
  );

  protected readonly currentSymbol = computed(() => {
    const cursor = this.debouncedCursor();
    if (!cursor) return null;
    return this.editorContext.getSymbolAt(cursor.view, cursor.pos);
  });

  protected readonly docEntry = computed(() => {
    const symbol = this.currentSymbol();
    if (!symbol) return null;
    return this.docsService.lookup(symbol);
  });

  protected readonly showCheatSheet = signal(false);

  constructor() {
    // Auto-show symbol docs as soon as a doc entry becomes available.
    effect(() => {
      if (this.docEntry()) this.showCheatSheet.set(false);
    });
  }
}
