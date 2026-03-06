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

* [x] **Shortcuts:** `Ctrl+S` saves immediately; `Ctrl+R` saves and runs.
* [x] **Theming:** Dark/Light/System mode toggle following M3 system tokens.
* [x] **Tabs:** Panel with M3 tabs (Output, AI, REPL, Packages); Output auto-scrolls to bottom.
* [x] **Panels:** Layout toggle button (Editor | Both | Panel); draggable splitter between panes.
* [x] **Output UX:** Clear button appears top-right of Output when content is present.
* [x] **Virtual Keyboard:** Viewport shrinks correctly when Android virtual keyboard is open (`VirtualKeyboardAPI` + `env(keyboard-inset-height)`); FAB repositions above keyboard.
* [x] **Editor Scrolling:** Touch/gesture scroll inside the editor.

### Phase 3: PWA & Sharing ✅ (partial)

* [x] **Installation:** PWA manifest + service worker; "Add to Home Screen" support for Android and Chromebooks. Full icon set (regular, maskable, monochrome).
* [x] **Offline Mode:** MicroPython WASM runtime self-hosted in `public/pyscript/`; all fonts (Roboto, Roboto Mono, Material Icons) bundled locally. Zero external dependencies at runtime.
* [x] **Download File:** Button to quickly download the current file as `main.py`.
* [ ] **URL Packaging:** Share snippets via LZ-compressed Base64 strings in the URL.

### Phase 4: Packages, REPL, and Debugging

* [x] **Integrated REPL:** Interactive MicroPython REPL in the panel tab using the xterm.js terminal that is already bundled with PyScript — no extra npm dependencies. Supports dark/light theming.
* [ ] **Dependency Management (`mip`):** Packages tab find and use libraries from the `micropython-lib`.
* [ ] **Package Bundling:** Update the "Share" logic to include a list of required packages in the URL so shared snippets automatically "install" their dependencies on first run.

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
| `RunnerService` | `src/app/runner/` | Polls for `window.pypad_run`; exposes `isReady` signal and `run(code)`. |
| `ReplService` | `src/app/repl/` | Polls for `window.pypad_interpreter`; `startRepl(el, isDark)` dynamically imports xterm.js from PyScript's local bundle, wires `io.stdout` → terminal and terminal keystrokes → `replProcessChar`; `setTheme(isDark)` for live theme switching. |
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
