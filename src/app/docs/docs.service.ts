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
  private baseEntries: Record<string, DocEntry> = {};
  readonly isLoaded = signal(false);

  constructor() {
    void this._load();
  }

  private async _load(): Promise<void> {
    const url = new URL('assets/docs.json', this.doc.baseURI).href;
    const data = (await fetch(url).then((r) => r.json())) as Record<string, DocEntry>;
    // Scraped entries win on collision (they are more specific than keyword stubs).
    this.baseEntries = { ...KEYWORD_DOCS, ...data };
    this.entries = this.baseEntries;
    this.isLoaded.set(true);
  }

  /**
   * Tries to load a platform-specific docs overlay from
   * `assets/docs-<platform>.json` and merges its entries on top of the base
   * docs. Silently ignores 404s and other fetch errors.
   */
  async setPlatform(platform: string): Promise<void> {
    if (!platform) return;
    const url = new URL(`assets/docs-${platform}.json`, this.doc.baseURI).href;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const overlay = (await res.json()) as Record<string, DocEntry>;
      this.entries = { ...this.baseEntries, ...overlay };
    } catch {
      // No platform-specific docs available — keep base entries.
    }
  }

  lookup(fqn: string): DocEntry | null {
    return this.entries[fqn] ?? null;
  }
}
