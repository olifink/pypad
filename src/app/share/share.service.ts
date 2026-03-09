import { Injectable, DOCUMENT, inject } from '@angular/core';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

/** Versioned payload stored in the ?s= query param. */
interface SharePayload {
  /** Schema version — always 1 for this format. */
  v: 1;
  /** Python source code. */
  c: string;
  /** mip package names required by this snippet (optional). */
  p?: string[];
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly location = inject(DOCUMENT).location;

  /** Returns a full URL with the code (and optional packages) compressed into `?s=`. */
  buildShareUrl(code: string, packages: string[] = []): string {
    const payload: SharePayload = { v: 1, c: code };
    if (packages.length > 0) payload.p = packages;
    const url = new URL(this.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('s', compressToEncodedURIComponent(JSON.stringify(payload)));
    return url.toString();
  }

  /**
   * Reads the `?s=` query param and decompresses it.
   *
   * Supports both the current JSON payload format (`{ v:1, c, p? }`) and the
   * legacy plain-string format (code only, no packages) for backward compatibility.
   *
   * Returns `null` if the param is absent or the value is invalid.
   */
  getSharedCode(): { code: string; packages: string[] } | null {
    const encoded = new URLSearchParams(this.location.search).get('s');
    if (!encoded) return null;
    try {
      const raw = decompressFromEncodedURIComponent(encoded);
      if (!raw) return null;
      try {
        const payload = JSON.parse(raw) as SharePayload;
        if (payload.v === 1 && typeof payload.c === 'string') {
          return { code: payload.c, packages: payload.p ?? [] };
        }
      } catch {
        // Not JSON — legacy format: the raw string is the code.
      }
      return { code: raw, packages: [] };
    } catch {
      return null;
    }
  }

  /**
   * Removes the `?s=` query param from the browser URL without triggering
   * a navigation. Safe to call after Angular's router has settled.
   */
  stripShareParam(): void {
    const url = new URL(this.location.href);
    if (!url.searchParams.has('s')) return;
    url.searchParams.delete('s');
    history.replaceState(null, '', url.toString());
  }
}
