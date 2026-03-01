import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ViewEncapsulation,
  input,
  output,
  afterNextRender,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';

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
  readonly codeChange = output<string>();

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private editorView?: EditorView;

  constructor() {
    afterNextRender(() => {
      this.editorView = new EditorView({
        doc: this.initialCode(),
        extensions: [
          basicSetup,
          python(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.codeChange.emit(update.state.doc.toString());
            }
          }),
        ],
        parent: this.container().nativeElement,
      });
    });
  }

  ngOnDestroy(): void {
    this.editorView?.destroy();
  }
}
