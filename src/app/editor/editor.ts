import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewEncapsulation,
  effect,
  input,
  output,
  afterNextRender,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from "@codemirror/view"
import { indentUnit } from "@codemirror/language"

export interface CursorInfo {
  view: EditorView;
  pos: number;
}
import { indentWithTab } from "@codemirror/commands"
import { Compartment, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { python } from '@codemirror/lang-python';
import { materialDark } from '@fsegurai/codemirror-theme-material-dark';
import { materialLight } from '@fsegurai/codemirror-theme-material-light';

const highlightLineEffect = StateEffect.define<number | null>();

const highlightLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(highlightLineEffect)) {
        if (effect.value === null) {
          decorations = Decoration.none;
        } else {
          const line = tr.state.doc.line(
            Math.min(effect.value, tr.state.doc.lines),
          );
          decorations = Decoration.set([
            Decoration.line({ class: 'cm-error-line' }).range(line.from),
          ]);
        }
      }
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

@Component({
  selector: 'app-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './editor.html',
  styleUrl: './editor.css',
  host: { class: 'app-editor' },
})
export class EditorComponent implements OnDestroy {
  readonly initialCode = input('');
  readonly isDark = input(false);
  readonly codeChange = output<string>();
  readonly cursorChange = output<CursorInfo>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly themeCompartment = new Compartment();
  private editorView?: EditorView;

  constructor() {
    afterNextRender(() => {
      this.editorView = new EditorView({
        doc: this.initialCode(),
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          indentUnit.of("    "),
          python(),
          highlightLineField,
          this.themeCompartment.of(this.isDark() ? materialDark : materialLight),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.codeChange.emit(update.state.doc.toString());
            }
            if (update.selectionSet) {
              const pos = update.state.selection.main.head;
              this.cursorChange.emit({ view: update.view, pos });
            }
          }),
        ],
        parent: this.container().nativeElement,
      });
    });

    effect(() => {
      const theme = this.isDark() ? materialDark : materialLight;
      this.editorView?.dispatch({ effects: this.themeCompartment.reconfigure(theme) });
    });
  }

  focus(): void {
    this.editorView?.focus();
  }

  /** Highlights the given 1-based line number and scrolls it into view. */
  goToLine(lineNumber: number): void {
    const view = this.editorView;
    if (!view) return;
    const clampedLine = Math.min(Math.max(lineNumber, 1), view.state.doc.lines);
    const line = view.state.doc.line(clampedLine);
    view.dispatch({
      effects: highlightLineEffect.of(clampedLine),
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
  }

  /** Removes the error line highlight. */
  clearErrorHighlight(): void {
    this.editorView?.dispatch({ effects: highlightLineEffect.of(null) });
  }

  setContent(code: string): void {
    const view = this.editorView;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
    });
  }

  insertText(text: string): void {
    const view = this.editorView;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    });
    view.focus();
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }
}
