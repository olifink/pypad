import { Injectable } from '@angular/core';

/**
 * Opts into the Virtual Keyboard API (Chrome on Android / ChromeOS).
 * When active, the keyboard overlays the viewport and CSS
 * `env(keyboard-inset-height, 0px)` reflects the keyboard height,
 * letting CSS push content up without a layout reflow.
 */
@Injectable({ providedIn: 'root' })
export class VirtualKeyboardService {
  constructor() {
    // We rely on the browser's native 'resizes-content' viewport behavior for dialogs.
    // Setting overlaysContent=true can prevent the layout viewport from resizing,
    // which makes vertical centering in the visible area difficult for fixed overlays.
  }
}
