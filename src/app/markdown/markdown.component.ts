import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { marked } from 'marked';

@Component({
  selector: 'app-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ViewEncapsulation.None so that styles reach [innerHTML]-rendered elements.
  encapsulation: ViewEncapsulation.None,
  template: `<div class="md-content" [innerHTML]="html()"></div>`,
  styleUrl: './markdown.component.css',
})
export class MarkdownComponent {
  private readonly doc = inject(DOCUMENT);

  readonly src = input.required<string>();

  protected readonly html = signal('');

  constructor() {
    effect(() => {
      void this.load(this.src());
    });
  }

  private async load(src: string): Promise<void> {
    const url = new URL(src, this.doc.baseURI).href;
    const text = await fetch(url).then((r) => r.text());
    this.html.set(marked.parse(text) as string);
  }
}
