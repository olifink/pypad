import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { DocumentationService } from './docs.service';
import { EditorContextService } from './editor-context.service';
import type { CursorInfo } from '../editor/editor';

@Component({
  selector: 'app-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.css',
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
}
