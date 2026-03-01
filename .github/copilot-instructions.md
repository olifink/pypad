# PyPad — Copilot Instructions

## Project Overview

PyPad is a mobile-first, browser-based Python IDE targeting Android tablets and Chromebooks. It provides a DartPad-like experience using:
- **Angular 21** (signals-based reactivity, standalone components)
- **Angular Material 3** with dynamic M3 theming (`src/material-theme.scss`, loaded globally via `angular.json`)
- **CodeMirror 6** (`@codemirror/lang-python`) for the editor
- **PyScript `mpy` (MicroPython WASM)** runtime for in-browser Python execution (loaded via CDN in `index.html`)
- **LocalStorage** for MVP persistence (File System Access API planned post-MVP)

### Planned Core Components (from README)

| Symbol | Role |
|---|---|
| `EditorComponent` | Owns the CodeMirror 6 instance; exposes code as a signal |
| `ConsoleComponent` | Displays stdout/stderr from Python execution |
| `RunnerService` | Singleton; initializes PyScript runtime and calls `exec()` |
| `StorageService` | Debounced LocalStorage persistence of editor state |

## Commands

```bash
npm start          # dev server (ng serve)
npm run build      # production build
npm test           # run all tests (Vitest)
```

Run a single test file:
```bash
npx ng test --include="**/app.spec.ts"
```

Format code (Prettier, printWidth=100, singleQuote):
```bash
npx prettier --write .
```

> There is no `lint` script. ESLint is not currently configured.

## Key Conventions

- **Angular version: 21** — Do NOT set `standalone: true` in decorators (it is the default).
- **Tests use Vitest**, not Jasmine/Karma. The `tsconfig.spec.json` types include `vitest/globals`.
- **Prettier** is configured: 100-char print width, single quotes, `angular` HTML parser.
- **PyScript integration**: loaded as a `<script type="module">` CDN tag in `index.html`. Python code is passed as strings to the MicroPython runtime.
- **Mobile-first UX**: design for touch/virtual keyboards; avoid hover-only interactions.

---

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
