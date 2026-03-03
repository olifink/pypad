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
import { indentWithTab } from "@codemirror/commands"
import { Compartment } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { materialDark } from '@fsegurai/codemirror-theme-material-dark';
import { materialLight } from '@fsegurai/codemirror-theme-material-light';

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
          python(),
          this.themeCompartment.of(this.isDark() ? materialDark : materialLight),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.codeChange.emit(update.state.doc.toString());
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

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }
}
