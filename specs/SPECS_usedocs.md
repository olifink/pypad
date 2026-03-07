# Spec: Context-Aware Documentation Lookup

## 1. Overview

PyPad must identify the "Fully Qualified Name" (FQN) of a Python symbol at the cursor position. The system must use CodeMirror’s Lezer-based syntax tree to distinguish between actual code symbols and non-relevant tokens (strings, comments, keywords).

## 2. Token Identification Logic

The agent should implement a resolution algorithm that follows these rules:

### A. Context Filtering

Before searching the `docs.json`, the system must check the `NodeType` at the cursor:

* **Allowed Nodes:** `VariableName`, `PropertyName`, `Attribute`, `FunctionName`.
* **Ignored Nodes:** `String`, `Comment`, `Number`, `Keyword` (e.g., `def`, `if`), `Operator`.

### B. Path Resolution (The "Dot" Walker)

If a user clicks on `Pin` in `machine.Pin.OUT`, a simple word lookup fails. The agent must "walk" the syntax tree:

1. **Start** at the cursor's leaf node.
2. **Check Parent:** If the parent is a `MemberExpression` or `Attribute`, traverse the siblings.
3. **Construct FQN:** Reconstruct the full string (e.g., `machine` + `.` + `Pin` + `.` + `OUT`).

---

## 3. Implementation Steps for the Agent

### Phase A: `EditorContextService` (Angular)

Create a service that interacts with the `EditorView` to extract the symbol:

1. **Method:** `getSymbolAt(view: EditorView, pos: number): string | null`
2. **Logic:**
* Resolve the tree at `pos`.
* Verify the node type is documented-eligible.
* If part of a chain (e.g., `obj.method`), concatenate the parts.



### Phase B: `DocumentationComponent` (M3 UI)

Create a reactive UI component for 'Docs' as part of the panels structure:

1. **Trigger:** Subscribe to cursor position changes (debounced by 300ms) or a specific "Help" hotkey.
2. **Lookup:** Pass the identified string to the `DocumentationService`.
3. **Display:** If a match is found in `docs.json`, render:
* **M3 Typography:** Use `Roboto Mono` for the function name and `body-medium` for the description.
* **Code Block:** A syntax-highlighted block for the `signature`.
* **External Link:** An "Open Official Docs" button.



### Phase C: CodeMirror Tooltip Extension

1. Integrate the `hoverTooltip` extension from `@codemirror/view`.
2. Call `EditorContextService.getSymbolAt()` within the tooltip provider.
3. Return a DOM element containing a "Mini-Doc" preview if the symbol is recognized.

---

## 4. Requirements for Agent

* **Syntax Awareness:** Use the `@codemirror/language` package's `syntaxTree` function.
* **Performance:** Avoid re-parsing the whole document; use the incremental tree provided by CodeMirror.
* **Robustness:** Handle "empty" lookups gracefully—if no documentation exists for a valid symbol, show a "Definition found, but no local documentation available" message.
