# PyPad: Lightweight Python IDE

**PyPad** is a modern, mobile-first Python development environment that runs entirely in the browser. Built for Android tablets, Chromebooks, and web users, it offers a "DartPad-like" experience for quick Python prototyping without the overhead of a desktop IDE.

## 🚀 Vision

To provide a zero-install, offline-capable Python editor that feels like a native Material 3 application, leveraging WebAssembly for near-instant execution.

---

## 🏗️ Architecture

* **Framework:** Angular 21 (Signals-based reactivity, standalone components).
* **UI System:** Angular Material 3 (M3) with dynamic theming (`material-theme.scss`).
* **Editor:** CodeMirror 6 with `@fsegurai/codemirror-theme-material-dark/light` themes.
* **Engine:** PyScript `mpy` (MicroPython WASM) — self-hosted in `public/pyscript/` for offline use.
* **Persistence:** LocalStorage (MVP) → File System Access API (Post-MVP).
* **Deployment:** GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`).

---

## 🛠️ Roadmap & Phases

### Phase 1: MVP ✅

* [x] **App Scaffold:** Responsive M3 Shell (Top-bar, Editor area, Output Console).
* [x] **CodeMirror Integration:** Python syntax highlighting and auto-indent.
* [x] **MicroPython Bridge:** Integration of PyScript `mpy` runtime to execute code strings.
* [x] **Reactive Output:** Intercepting Python `stdout` to display in the UI console.
* [x] **Auto-Save:** Debounced persistence of the current session to `localStorage`.

### Phase 2: UX ✅

* [x] **Shortcuts:** `Ctrl+S` saves immediately; `Ctrl+R` saves and runs; `Ctrl+O` opens a file; `Ctrl+?` (Ctrl+Shift+/ on US keyboards) switches to the Docs tab without stealing editor focus.
* [x] **Theming:** Dark/Light/System mode toggle following M3 system tokens.
* [x] **Tabs:** Panel with M3 tabs (Output, Docs, REPL, Packages); Output auto-scrolls to bottom.
* [x] **Panels:** Layout toggle button (Editor | Both | Panel); draggable splitter between panes.
* [x] **Output UX:** Clear button appears top-right of Output when content is present.
* [x] **Virtual Keyboard:** Viewport shrinks correctly when Android virtual keyboard is open (`VirtualKeyboardAPI` + `env(keyboard-inset-height)`); FAB repositions above keyboard.
* [x] **Editor Scrolling:** Touch/gesture scroll inside the editor.

### Phase 3: PWA & Sharing ✅

* [x] **Installation:** PWA manifest + service worker; "Add to Home Screen" support for Android and Chromebooks. Full icon set (regular, maskable, monochrome).
* [x] **Offline Mode:** MicroPython WASM runtime self-hosted in `public/pyscript/`; all fonts (Roboto, Roboto Mono, Material Icons) bundled locally. Zero external dependencies at runtime.
* [x] **Download File:** Button to quickly download the current file as `main.py`.
* [x] **URL Sharing:** Share the current file via a compressed URL (`?s=` query param, LZ-compressed). A dialog shows the full shareable link with a one-click copy button and a client-side QR code. Opening a share URL automatically loads the code into the editor.

### Phase 4: Packages, REPL, and Debugging ✅

* [x] **Integrated REPL:** Interactive MicroPython REPL in the panel tab using the xterm.js terminal that is already bundled with PyScript — no extra npm dependencies. Supports dark/light theming.
* [x] **Dependency Management (`mip`):** Packages tab to install libraries from `micropython-lib` via `mip.install()`. Installed packages survive REPL resets (automatically re-installed on each new interpreter instance). Package list is tracked in `PackagesService`.
* [x] **Package Bundling:** Share URLs include a list of required packages (`{ v:1, c:code, p?:packages[] }` JSON payload, LZ-compressed). Opening a shared URL auto-installs its packages once the interpreter is ready and switches to the Packages tab. Backward-compatible with old plain-string share URLs.

### Phase 5: AI Coding Support

* [ ] **API Key:** Encode with Web Crypto API and save to localStorage.
* [ ] **Gemini Service:** An Angular service that initializes the GoogleGenerativeAI client using the stored key.
* [ ] **AI Prompt**: Prompt AI generate and insert code at cursor or refactor code if selected.

### Phase 6: Web Host Interaction

* [ ] **JS Bridge:** Allowing Python code to manipulate the DOM or call Web APIs (GPS, Camera) via PyScript's FFI.

### Phase 7: Hardware Integration
- [ ] **Web Serial Bridge:** Connect to physical MicroPython boards (Pico, ESP32).
- [ ] **Flash to Board:** Upload `main.py` directly from the browser to the board's flash memory.
- [ ] **Hardware REPL:** Toggle the console to interact with the physical device's output.

### Parking lot

* [ ] **Sticky Accessory Bar:** Touch-friendly Python symbol bar above virtual keyboard.
* [ ] **Multi-file Support:** Tabbed interface for managing multiple `.py` snippets/files.

### Deferred

* [ ] **Live Autocomplete:** Bridge between CodeMirror and MicroPython's `dir()` for real-time object inspection.
* [ ] **Visual State Inspector:** Instead of a full `break` debugger, implement a "Snapshot" tool that runs `globals()` after execution and displays variables/types in an M3 Data Table.
* [ ] **Exception Mapping:** Write a parser that takes MicroPython stack traces and uses the **CodeMirror 6 `EditorView**` to highlight the exact line of code where the error occurred with an M3 "Error" gutter icon.


---

## 💻 Technical Specifications

### Core Components & Services

| Symbol | Path | Responsibility |
| --- | --- | --- |
| `EditorComponent` | `src/app/editor/` | CodeMirror 6 instance; `isDark` input swaps Material theme via `Compartment`; emits `codeChange`; `ResizeObserver` tracks container height. |
| `ConsoleComponent` | `src/app/console/` | Scrollable monospace output panel; accepts `lines: string[]` input; auto-scrolls to bottom; clear button. |
| `ReplComponent` | `src/app/repl/` | Hosts the xterm.js terminal for the interactive REPL tab; lazy-inits on first render; `ResizeObserver` keeps the terminal sized to its container. |
| `DocumentationComponent` | `src/app/docs/` | Docs tab; debounces cursor position and looks up the symbol under the caret in `DocumentationService`; shows signature, description, and a deep-link to the official docs. |
| `RunnerService` | `src/app/runner/` | Polls for `window.pypad_run`; exposes `isReady` signal and `run(code)`. |
| `ReplService` | `src/app/repl/` | Polls for `window.pypad_interpreter`; `startRepl(el, isDark)` dynamically imports xterm.js from PyScript's local bundle, wires `io.stdout` → terminal and terminal keystrokes → `replProcessChar`; `resetRepl()` loads a fresh WASM instance, re-registers `pypad_run`, and reinstalls tracked packages; `setTheme(isDark)` for live theme switching. |
| `PackagesService` | `src/app/packages/` | Installs packages via `mip.install()` using `interpreter.runPython()`; tracks `installedPackages` signal; `reinstallAll()` re-installs all packages on a fresh interpreter after a REPL reset. |
| `DocumentationService` | `src/app/docs/` | Loads `assets/docs.json` (scraped MicroPython + CPython builtins); merges with a static `KEYWORD_DOCS` map covering ~36 Python keywords; exposes `lookup(fqn)`. |
| `EditorContextService` | `src/app/docs/` | Resolves the symbol or keyword at the current cursor position using the lezer syntax tree. |
| `ShareService` | `src/app/share/` | `buildShareUrl(code, packages?)` compresses a versioned JSON payload `{ v:1, c:code, p?:packages[] }` with `lz-string` into a `?s=` query param; `getSharedCode()` decompresses it, with fallback for legacy plain-string URLs. |
| `StorageService` | `src/app/storage/` | Debounced `save()` + immediate `flush()` to `localStorage` key `pypad_code`. |
| `ThemeService` | `src/app/theme/` | Three-way `light`/`dark`/`system` toggle; `effectiveIsDark` computed signal; persists to `localStorage`. |
| `VirtualKeyboardService` | `src/app/virtual-keyboard/` | Opts into Virtual Keyboard API (`overlaysContent = true`); CSS `env(keyboard-inset-height)` shrinks the viewport. |

### PyScript Configuration

The MicroPython runtime is self-hosted under `public/pyscript/` (copied from the official `offline_2026.2.1.zip` release). It is injected dynamically to avoid Vite dev-server pre-transform conflicts:

```html
<script>
  const s = document.createElement('script');
  s.type = 'module';
  s.src = 'pyscript/core.js';
  document.head.appendChild(s);
</script>
```

A second inline `<script>` (regular, not `type="module"`) imports `hooks` from `core.js` via a runtime-constructed URL and registers a `hooks.main.onReady` callback that stores the raw MicroPython `interpreter` and `io` objects on `globalThis` (`window.pypad_interpreter`, `window.pypad_io`). Using a plain script with a dynamic `import()` prevents Vite's static import analysis from trying to bundle the PyScript assets.

An inline `<script type="mpy">` defines `_pypad_run(code)` which captures `print()` output by injecting a custom `print` into `exec` globals, then exposes it as `window.pypad_run`. Run `npm run icons` to regenerate icons from source SVG.
