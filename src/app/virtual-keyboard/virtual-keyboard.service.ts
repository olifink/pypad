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
    const vk = (navigator as Navigator & { virtualKeyboard?: { overlaysContent: boolean } })
      .virtualKeyboard;
    if (vk) vk.overlaysContent = true;
  }
}
