# PyPad: Lightweight Python IDE

**PyPad** is a modern, mobile-first Python development environment that runs entirely in the browser. Built for Android tablets, Chromebooks, and web users, it offers a "DartPad-like" experience for quick Python prototyping without the overhead of a desktop IDE.

## 🚀 Vision

To provide a zero-install, offline-capable Python editor that feels like a native Material 3 application, leveraging WebAssembly for near-instant execution.

---

## 🏗️ Architecture

* **Framework:** Angular 21 (Signals-based reactivity, standalone components).
* **UI System:** Angular Material 3 (M3) with dynamic theming (`material-theme.scss`).
* **Editor:** CodeMirror 6 with `@fsegurai/codemirror-theme-material-dark/light` themes.
* **Engine:** PyScript `mpy` (MicroPython WASM) loaded via CDN in `index.html`.
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

### Phase 2: UX

* [x] **Shortcuts:** `Ctrl+S` saves immediately; `Ctrl+R` saves and runs.
* [ ] **Multi-file Support:** Tabbed interface for managing multiple `.py` snippets/files.
* [x] **Theming:** Dark/Light/System mode toggle following M3 system tokens.

### Phase 3: PWA & Sharing

* [ ] **Offline Mode:** Service Worker caching for WASM binaries and assets.
* [ ] **URL Packaging:** Share snippets via LZ-compressed Base64 strings in the URL.
* [ ] **Installation:** "Add to Home Screen" support for Android and Chromebooks.

### Phase 4: Packages, REPL, and Debugging

* [ ] **Integrated REPL Overlay:** REPL tab using **Xterm.js** terminal 
* [ ] **Dependency Management (`mip`):** Packages tab find and use libraries from the `micropython-lib`
* [ ] **Package Bundling:** Update the "Share" logic to include a list of required packages in the URL so shared snippets automatically "install" their dependencies on first run.

### Phase 5: Web Host Interaction

* [ ] **JS Bridge:** Allowing Python code to manipulate the DOM or call Web APIs (GPS, Camera) via PyScript's FFI.

### Phase 6: Hardware Integration
- [ ] **Web Serial Bridge:** Connect to physical MicroPython boards (Pico, ESP32).
- [ ] **Flash to Board:** Upload `main.py` directly from the browser to the board's flash memory.
- [ ] **Hardware REPL:** Toggle the console to interact with the physical device's output.


### Deferred / Parking lot

* [ ] **Live Autocomplete:** Bridge between CodeMirror and MicroPython's `dir()` for real-time object inspection.
* [ ] **Visual State Inspector:** Instead of a full `break` debugger, implement a "Snapshot" tool that runs `globals()` after execution and displays variables/types in an M3 Data Table.
* **[ ] Exception Mapping:** Write a parser that takes MicroPython stack traces and uses the **CodeMirror 6 `EditorView**` to highlight the exact line of code where the error occurred with an M3 "Error" gutter icon.


---

## 💻 Technical Specifications

### Core Components & Services

| Symbol | Path | Responsibility |
| --- | --- | --- |
| `EditorComponent` | `src/app/editor/` | CodeMirror 6 instance; `isDark` input swaps Material theme via `Compartment`; emits `codeChange`. |
| `ConsoleComponent` | `src/app/console/` | Scrollable monospace output panel; accepts `lines: string[]` input. |
| `RunnerService` | `src/app/runner/` | Polls for `window.pypad_run`; exposes `isReady` signal and `run(code)`. |
| `StorageService` | `src/app/storage/` | Debounced `save()` + immediate `flush()` to `localStorage` key `pypad_code`. |
| `ThemeService` | `src/app/theme/` | Three-way `light`/`dark`/`system` toggle; `effectiveIsDark` computed signal; persists to `localStorage`. |

### PyScript Configuration

The MicroPython runtime is loaded via CDN. An inline `<script type="mpy">` defines `_pypad_run(code)` which captures `print()` output by injecting a custom `print` into `exec` globals, then exposes it as `window.pypad_run`:

```html
<script type="module" src="https://pyscript.net/releases/2026.2.1/core.js"></script>
```
