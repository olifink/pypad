import { Injectable, DOCUMENT, inject } from '@angular/core';

const SHARE_CACHE = 'pypad-share-v1';
const SHARE_DATA_KEY = '/share-target-data';

interface ShareTargetPayload {
  text: string;
  title: string;
  url: string;
  fileContent: string | null;
  fileName: string | null;
  timestamp: number;
}

/**
 * Strips a Markdown fenced code block from a string, returning only the content
 * inside the fences. If no fence is detected the original (trimmed) string is returned.
 *
 * Handles both ` ```python ` and bare ` ``` ` opening fences.
 */
export function stripCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  return match ? match[1] : trimmed;
}

@Injectable({ providedIn: 'root' })
export class ShareTargetService {
  private readonly location = inject(DOCUMENT).location;

  /** Returns true when the app was launched by the OS share sheet. */
  hasPendingShare(): boolean {
    return new URLSearchParams(this.location.search).has('share');
  }

  /**
   * Reads the pending share payload from the Cache API, deletes it (one-shot),
   * and returns the processed code string (backtick fences stripped).
   *
   * Prefers file content over the shared text field.
   * Returns `null` if there is no pending share or the Cache API is unavailable.
   */
  async getAndConsumeSharedCode(): Promise<string | null> {
    if (!this.hasPendingShare()) return null;
    if (!('caches' in globalThis)) return null;

    try {
      const cache = await caches.open(SHARE_CACHE);
      const response = await cache.match(SHARE_DATA_KEY);
      if (!response) return null;

      const payload = (await response.json()) as ShareTargetPayload;

      // Consume: remove from cache so a reload doesn't re-load the share.
      await cache.delete(SHARE_DATA_KEY);

      const raw = payload.fileContent ?? payload.text ?? '';
      return stripCodeBlock(raw) || null;
    } catch {
      return null;
    }
  }

  /** Removes `?share=pending` from the browser URL without triggering navigation. */
  stripSharePending(): void {
    const url = new URL(this.location.href);
    if (!url.searchParams.has('share')) return;
    url.searchParams.delete('share');
    history.replaceState(null, '', url.toString());
  }
}
