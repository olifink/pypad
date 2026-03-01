# PyPad: Lightweight Python IDE

**PyPad** is a modern, mobile-first Python development environment that runs entirely in the browser. Built for Android tablets, Chromebooks, and web users, it offers a "DartPad-like" experience for quick Python prototyping without the overhead of a desktop IDE.

## 🚀 Vision

To provide a zero-install, offline-capable Python editor that feels like a native Material 3 application, leveraging WebAssembly for near-instant execution.

---

## 🏗️ Architecture

* **Framework:** Angular 19+ (Signals-based reactivity).
* **UI System:** Angular Material 3 (M3) with dynamic theming.
* **Editor:** CodeMirror 6 (Optimized for mobile touch/virtual keyboards).
* **Engine:** PyScript (configured with the **MicroPython** WASM runtime).
* **Persistence:** LocalStorage (MVP) $\rightarrow$ File System Access API (Post-MVP).

---

## 🛠️ Roadmap & Phases

### Phase 1: MVP (Current Focus)

* [ ] **App Scaffold:** Responsive M3 Shell (Top-bar, Editor area, Output Console).
* [ ] **CodeMirror Integration:** Python syntax highlighting and auto-indent.
* [ ] **MicroPython Bridge:** Integration of PyScript `mpy` runtime to execute code strings.
* [ ] **Reactive Output:** Intercepting Python `stdout` to display in the UI console.
* [ ] **Auto-Save:** Simple persistence of the current session to `localStorage`.

### Phase 2: Intelligence & UX

* [ ] **Live Autocomplete:** Bridge between CodeMirror and MicroPython's `dir()` for real-time object inspection.
* [ ] **Multi-file Support:** Tabbed interface for managing multiple `.py` snippets.
* [ ] **Theming:** Dark/Light mode toggle following M3 system tokens.

### Phase 3: PWA & Sharing

* [ ] **Offline Mode:** Service Worker caching for WASM binaries and assets.
* [ ] **URL Packaging:** Share snippets via LZ-compressed Base64 strings in the URL.
* [ ] **Installation:** "Add to Home Screen" support for Android and Chromebooks.

### Phase 4: Host Interaction

* [ ] **JS Bridge:** Allowing Python code to manipulate the DOM or call Web APIs (GPS, Camera) via PyScript's FFI.

---

## 💻 Technical Specifications (Phase 1)

### Core Components

| Component | Responsibility |
| --- | --- |
| `EditorComponent` | Manages the CodeMirror 6 instance and provides code signals. |
| `ConsoleComponent` | Displays execution results and error logs in a scrollable panel. |
| `RunnerService` | Singleton that initializes the PyScript runtime and triggers `exec()`. |
| `StorageService` | Debounced persistence of the editor state. |

### PyScript Configuration

We utilize the `mpy` (MicroPython) engine for sub-second startup times on mobile devices:

```html
<script type="module" src="https://pyscript.net/releases/2026.2.1/core.js"></script>

```
