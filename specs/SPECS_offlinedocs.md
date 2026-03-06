# Spec: Offline Documentation System (`docs.json`)

## 1. Overview

The goal is to build an offline-first documentation lookup service for PyPad. Since MicroPython lacks built-in docstrings, we will use a local `assets/docs.json` file to provide quick-reference info (signatures, descriptions, and deep-links) in a "Docs" panel when cursor moves through code in the editor.

## 2. Data Structure (`docs.json`)

The agent must generate a JSON structure that maps fully qualified module/class/method names to their metadata.

```json
{
  "machine.Pin.irq": {
    "signature": "irq(handler=None, trigger=Pin.IRQ_FALLING | Pin.IRQ_RISING)",
    "description": "Configures an interrupt handler for the pin.",
    "url": "https://docs.micropython.org/en/latest/library/machine.Pin.html#machine.Pin.irq"
  }
}

```

## 3. Implementation Steps for the Agent

### Phase A: Extraction Strategy

1. **Clone Source:** Clone/fetch the [MicroPython Documentation source](https://github.com/micropython/micropython/tree/master/docs).
2. **Parser Script:** Write a small Python script (`build_docs.py`) that uses `BeautifulSoup` or `sphinx` to traverse the RST files.
3. **Target Modules:** Extract metadata specifically for these core modules: `machine`, `math`, `sys`, `time`, `network`, `json`, `random`.
4. **Minification:** Output the final result as `src/assets/docs.json`.

### Phase B: Angular Service (`DocumentationService`)

1. Create `DocumentationService` to fetch/inject the JSON at app startup.
2. Implement a `getSymbolInfo(symbolName: string)` method that returns the metadata object or `null`.

### Phase C: UI Integration (CodeMirror 6)

1. Use the `hoverTooltip` extension in CodeMirror 6.
2. On hover, extract the word under the cursor.
3. Query `DocumentationService`.
4. If match exists, return an M3-styled tooltip:
* **Header:** Bold symbol name.
* **Body:** `<code>signature</code>` + description.
* **Footer:** "Open docs" link.



## 4. Requirements for Agent

* **Performance:** The lookup must be $O(1)$ (HashMap lookup).
* **Offline First:** The `docs.json` must be included in the Angular production build bundle.
* **Graceful Degradation:** If a symbol is not found in `docs.json`, the tooltip should simply not trigger (or show a "No info available" placeholder).
