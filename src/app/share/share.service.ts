import { Injectable, DOCUMENT, inject } from '@angular/core';
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private readonly location = inject(DOCUMENT).location;

  /** Returns a full URL with the code compressed into the `?s=` query param. */
  buildShareUrl(code: string): string {
    const url = new URL(this.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('s', compressToEncodedURIComponent(code));
    return url.toString();
  }

  /**
   * Reads the `?s=` query param from the current location and decompresses it.
   * Returns `null` if the param is absent or the value is invalid.
   * URL cleanup (stripping `?s=`) is handled separately by the caller after
   * Angular's router has completed its initial navigation.
   */
  getSharedCode(): string | null {
    const encoded = new URLSearchParams(this.location.search).get('s');
    if (!encoded) return null;
    try {
      return decompressFromEncodedURIComponent(encoded) || null;
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
