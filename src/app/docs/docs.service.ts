import { Injectable, DOCUMENT, inject, signal } from '@angular/core';
import { KEYWORD_DOCS } from './keyword-docs';

export interface DocEntry {
  signature: string;
  description: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentationService {
  private readonly doc = inject(DOCUMENT);
  private entries: Record<string, DocEntry> = { ...KEYWORD_DOCS };
  readonly isLoaded = signal(false);

  constructor() {
    void this._load();
  }

  private async _load(): Promise<void> {
    const url = new URL('assets/docs.json', this.doc.baseURI).href;
    const data = (await fetch(url).then((r) => r.json())) as Record<string, DocEntry>;
    // Scraped entries win on collision (they are more specific than keyword stubs).
    this.entries = { ...KEYWORD_DOCS, ...data };
    this.isLoaded.set(true);
  }

  lookup(fqn: string): DocEntry | null {
    return this.entries[fqn] ?? null;
  }
}
