# PyPad: Gemini CLI Context

PyPad is a lightweight, mobile-first Python IDE that runs entirely in the browser using MicroPython (WASM). It is built with Angular 21 and follows modern Material 3 design principles.

## Project Overview

- **Framework:** Angular 21 (Signals-based reactivity, standalone components).
- **UI System:** Angular Material 3 with dynamic theming.
- **Editor:** CodeMirror 6 with Material themes.
- **Engine:** MicroPython WASM (via PyScript `mpy`), self-hosted in `public/pyscript/` for offline capability.
- **Capabilities:** PWA support, offline mode, interactive REPL (xterm.js), package management (`mip`), and URL-based code sharing (LZ-compressed).
- **Target Platforms:** Android tablets, Chromebooks, and web browsers.

## Key Architecture & Services

- **`App` Component (`src/app/app.ts`):** The root component managing the layout (Editor/Panel split), global shortcuts, and feature integration.
- **`RunnerService` (`src/app/runner/runner.service.ts`):** Bridges the Angular application with the MicroPython interpreter.
- **`ReplService` (`src/app/repl/repl.service.ts`):** Manages the interactive xterm.js terminal and the Python REPL instance.
- **`PackagesService` (`src/app/packages/packages.service.ts`):** Handles package installation via `mip` and tracks installed libraries.
- **`ThemeService` (`src/app/theme/theme.service.ts`):** Manages Light/Dark/System themes using Material 3 design tokens.
- **`StorageService` (`src/app/storage/storage.service.ts`):** Persists user code to `localStorage`.
- **`ShareService` (`src/app/share/share.service.ts`):** Compresses/decompresses code and packages into shareable URLs.

## Development Guide

### Building and Running

- `npm start`: Start the development server (`ng serve`).
- `npm run build`: Build the production application (`ng build`).
- `npm run test`: Execute the test suite (Vitest/Angular).
- `npm run icons`: Regenerate PWA icons from source SVGs (`scripts/generate-icons.mjs`).
- `npm run docs`: Build the MicroPython documentation index (`scripts/build-docs.mjs`).

### Coding Standards

- **Angular Best Practices:**
  - Use **Signals** for all state management (`signal`, `computed`, `effect`).
  - Use **Standalone Components** (the default in this project).
  - Prefer **`inject()`** over constructor injection.
  - Use **OnPush** change detection for all components.
  - Employ **Modern Control Flow** (`@if`, `@for`, `@switch`) instead of structural directives.
  - Do NOT use `@HostBinding` or `@HostListener`; use the `host` property in the `@Component` decorator.
- **TypeScript:**
  - Strict type checking is enabled and must be maintained.
  - Avoid `any`; use `unknown` or specific interfaces.
- **Styling:**
  - Use SCSS with Material 3 design tokens.
  - Avoid `ngClass`/`ngStyle`; use native class/style bindings.

### Project Structure

- `src/app/`: Primary application logic and components.
- `public/pyscript/`: Self-hosted MicroPython WASM assets.
- `scripts/`: Utility scripts for icon generation and documentation processing.
- `assets/`: Static assets including icons and documentation JSON.
