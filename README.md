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

### Phase 5: AI Coding Support ✅

* [x] **API Key:** Stored in `localStorage`; managed via the AI Settings dialog.
* [x] **AI Service:** Angular service wrapping the Claude API; streams generated code into the editor.
* [x] **AI Prompt:** `Ctrl+\` opens a prompt dialog. With no selection: generates and inserts code at the cursor. With a selection: sends the selected code + instruction to fix/modify it.

### Phase 6: Hardware Integration ✅

* [x] **Web Serial Backend (`BoardService`):** Connect to a Raspberry Pi Pico (or any MicroPython board) over USB via the Web Serial API (Chrome/Chromium). The `usb` toolbar button opens the browser's port picker; turns primary-colour when connected. Hidden on browsers without Web Serial support.
* [x] **Hardware Run:** When a board is connected, the Run button executes code on the real MicroPython interpreter via the raw REPL protocol (`Ctrl+A` / code + `\x04` / read stdout+stderr / `Ctrl+B`). Output streams line-by-line to the Output tab.
* [x] **Hardware REPL:** The REPL tab auto-switches between WASM and board mode as the connection state changes. xterm.js is wired directly to the board's serial streams; the WASM interpreter is paused. Disconnecting restores the WASM REPL with a fresh interpreter.
* [x] **Soft Reset:** The Clear Output button sends a MicroPython soft reset (`Ctrl+D`) to the board when connected, restarting the interpreter without dropping the USB connection.
* [x] **File Operations (Board section in sidebar):** When a board is connected a "Board" section appears in the sidebar with three actions:
  * **Upload as main.py** — writes the current editor content to `main.py` on the board's flash (base64-encoded for safety) then soft-resets the board.
  * **Download main.py** — reads `main.py` from the board's flash and loads it into the editor (with a confirmation dialog).
  * **Clear main.py** — truncates `main.py` to zero bytes then soft-resets the board.

### Phase 7: Projects

A Project is a collection of files stored in an IndexDB using [lightning-fs](https://github.com/isomorphic-git/lightning-fs). Each project has a name that is used for the IndexDB. When a project is active, file operations are named files and store and read to the given project. Only one file is active at a time, there is no tab-UI or multiple open files.

* [x] **Sidebar:** Project section added to sidebar to create or switch to a project when none is open. If a project is open, the file names are shown in the sidebar, and option to close the project.
* [x] **Files:** Files need to be named. Files outside a project are treated as `main.py`. Files save automatically, asking for a name when none is given yet. Files and Projects can also be renamed. Initially, there is no need for directories.
* [x] **Operations:** When a project is active, File and Pico operations reflect and work with the current fs file.

### Phase 8: MicroPython Board Manager ✅

* [x] **Board Button:** The board toolbar button is now a menu with Connect, Board Manager, and Disconnect entries. Works with any MicroPython board (no USB vendor ID filter).
* [x] **Auto-Discovery Probe:** On connect, a lightweight probe script runs on the board via the raw REPL and captures `sys.platform`, board ID (`sys.implementation._machine`), CPU frequency, and memory stats (free / allocated KB). The result is stored in the `boardInfo` signal on `BoardService`.
* [x] **Board Manager Dialog:** Overlay dialog showing the detected board info panel (platform, CPU freq, memory) and a file manager: lists all files on the board's filesystem, with actions to upload, download, delete, and sync the active project.
* [x] **Board-Specific Docs:** On connect, `DocumentationService.setPlatform(sys.platform)` fetches and merges a `docs-<platform>.json` overlay on top of the base docs. On disconnect, docs reset to the base set. Run `npm run docs` to regenerate all doc files.

  | Platform (`sys.platform`) | Overlay file | Modules covered |
  |---|---|---|
  | `rp2` | `docs-rp2.json` | `rp2` (StateMachine, PIO, DMA, Flash) |
  | `esp32` | `docs-esp32.json` | `esp32`, `esp` |
  | `esp8266` | `docs-esp8266.json` | `esp` |
  | `stm32` / `pyboard` | `docs-stm32.json` / `docs-pyboard.json` | `stm`, `pyb` (full class hierarchy) |


### Phase 9: Basic PyScript Web Development
* [ ] **Web Page:** HTML/PyScript/JS-bridge editing with `iframe` output panel
* [ ] **Page Sharing:** Option to share as a page (app) instead of an editor
* [ ] **:** 

### Parking lot

* [ ] **Sticky Accessory Bar:** Touch-friendly Python symbol bar above virtual keyboard.
* [ ] **Multi-file Support:** Tabbed interface for managing multiple `.py` snippets/files.

---

## 💻 Technical Specifications

### Core Components & Services

| Symbol | Path | Responsibility |
| --- | --- | --- |
| `EditorComponent` | `src/app/editor/` | CodeMirror 6 instance; `isDark` input swaps Material theme via `Compartment`; emits `codeChange`; `ResizeObserver` tracks container height. |
| `ConsoleComponent` | `src/app/console/` | Scrollable monospace output panel; accepts `lines: string[]` input; auto-scrolls to bottom; clear button. |
| `ReplComponent` | `src/app/repl/` | Hosts the xterm.js terminal for the interactive REPL tab; lazy-inits on first render; `ResizeObserver` keeps the terminal sized to its container. |
| `DocumentationComponent` | `src/app/docs/` | Docs tab; debounces cursor position and looks up the symbol under the caret in `DocumentationService`; shows signature, description, and a deep-link to the official docs. |
| `BoardService` | `src/app/board/` | Web Serial connection to any MicroPython board. Manages port open/close, a single background read loop, and raw REPL protocol (`_enterRaw` / `_execRaw` / `_exitRaw`). Exposes `run()`, `stop()`, `softReset()`, `uploadFile()`, `downloadFile()`, `clearFile()`, `listFiles()`, `deleteFile()`, and `setReplHandler()` for xterm.js wiring. `isConnected`, `portLabel`, and `boardInfo` signals drive the UI. On connect, `probe()` runs a discovery script and populates `boardInfo` with platform, board ID, CPU freq, and memory stats. |
| `RunnerService` | `src/app/runner/` | `isReady` is a `computed()` signal — true when the WASM worker is initialised *or* a board is connected. `run()`, `stop()`, and `install()` delegate to `BoardService` when connected, otherwise to the WASM worker. |
| `ReplService` | `src/app/repl/` | `startRepl(el, isDark)` wires xterm.js to the board (`setReplHandler` / `writeBytes`) or to the WASM interpreter (`io.stdout` + `replProcessChar`). An `effect()` re-wires automatically when `board.isConnected()` changes while the terminal is open, disposing the previous `onData` subscription before installing the new one. `resetRepl()` and `runInRepl()` branch for board vs WASM. |
| `PackagesService` | `src/app/packages/` | Installs packages via `mip.install()` using `interpreter.runPython()`; tracks `installedPackages` signal; `reinstallAll()` re-installs all packages on a fresh interpreter after a REPL reset. |
| `BoardManagerComponent` | `src/app/board/board-manager/` | Dialog showing detected board info (platform, CPU freq, free/alloc memory) and a full file manager for the board's filesystem (list, upload, download, delete, sync project). |
| `DocumentationService` | `src/app/docs/` | Loads `assets/docs.json` (scraped MicroPython + CPython builtins); merges with a static `KEYWORD_DOCS` map covering ~36 Python keywords; exposes `lookup(fqn)`. `setPlatform(platform)` fetches and overlays a `docs-<platform>.json` file for board-specific symbols (e.g. `rp2.StateMachine`); passing `null` resets to base docs. |
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
