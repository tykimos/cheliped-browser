# Changelog

## v0.2.0 (2026-03-23)

### New Commands

#### `back` / `forward` — Browser History Navigation
Navigate back and forward through browser history without re-entering URLs.

```bash
# Visit two pages, then go back
node cheliped-cli.mjs '[{"cmd":"goto","args":["https://page-a.com"]},{"cmd":"goto","args":["https://page-b.com"]},{"cmd":"back"}]'

# Go forward again
node cheliped-cli.mjs '[{"cmd":"forward"}]'
```

- Uses CDP `Page.getNavigationHistory` + `Page.navigateToHistoryEntry` for reliable navigation
- Automatically resets framework detection cache on navigation
- No-op when already at the start/end of history (does not throw)

#### `hover` — Hover Over Elements
Hover over elements by agentId. Triggers dropdown menus, tooltips, and hover-dependent UI.

```bash
# Observe page, then hover over element 5
node cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"hover","args":["5"]}]'
```

- Dispatches real `mouseMoved` CDP events at element center coordinates
- Fallback: `mouseover` + `mouseenter` JS events for hidden/zero-size elements
- Enables interaction with CSS `:hover` menus without clicking

#### `scroll` — Directional Page Scrolling
Pixel-level page scrolling in any direction. Essential for infinite-scroll pages and content below the fold.

```bash
# Scroll down 500px
node cheliped-cli.mjs '[{"cmd":"scroll","args":["down","500"]}]'

# Scroll up with default 300px
node cheliped-cli.mjs '[{"cmd":"scroll","args":["up"]}]'

# Horizontal scroll
node cheliped-cli.mjs '[{"cmd":"scroll","args":["right","200"]}]'
```

- Directions: `up`, `down`, `left`, `right`
- Default: 300px per scroll
- Uses CDP `Input.dispatchMouseEvent` with `mouseWheel` type
- 200ms settle delay after each scroll

#### `wait-for` — Wait for CSS Selector
Wait for a CSS selector to appear in the DOM with configurable timeout. Critical for SPA apps with async rendering.

```bash
# Wait for element to appear (default 5s timeout)
node cheliped-cli.mjs '[{"cmd":"wait-for","args":["#search-results"]}]'

# Custom timeout (10s)
node cheliped-cli.mjs '[{"cmd":"wait-for","args":[".loaded-content","10000"]}]'
```

- Polls every 200ms until found or timeout
- Returns `{ found: true/false, selector: "..." }`
- Default timeout: 5000ms
- Does not throw on timeout — returns `found: false`

### Enhancements

#### Keyboard Combinations
`press-key` now supports modifier combos with `+` syntax.

```bash
# Select all text
node cheliped-cli.mjs '[{"cmd":"press-key","args":["ctrl+a"]}]'

# Shift+Tab (reverse tab)
node cheliped-cli.mjs '[{"cmd":"press-key","args":["shift+tab"]}]'

# Triple modifier
node cheliped-cli.mjs '[{"cmd":"press-key","args":["ctrl+shift+k"]}]'

# Mac Command key
node cheliped-cli.mjs '[{"cmd":"press-key","args":["meta+c"]}]'
```

- Supported modifiers: `ctrl` / `control`, `shift`, `alt`, `meta` / `cmd` / `command`
- Works with all existing keys (Enter, Tab, arrows, etc.) and single characters (a-z, 0-9)
- Uses CDP `modifiers` bitmask for proper OS-level key events

### Testing

- **19 new integration tests** covering all new features
- **Test fixture page** (`tests/fixtures/test-features.html`) with hover menus, scroll markers, keyboard logging, delayed content, and navigation links
- **5 pre-existing test failures fixed** — tests now match current design:
  - Empty arrays omitted for token efficiency (TOK-1)
  - Low-confidence actions (open_link: 0.3, click_button: 0.4) correctly filtered by 0.7 threshold
- **Final results**: Unit 107/107, Integration 30/30

### Files Changed

| File | Change |
|:-----|:-------|
| `src/browser/controller.ts` | +5 methods: `goBack`, `goForward`, `hoverByBackendNodeId`, `scroll`, `waitForSelector`. Extended `pressKey` with modifier combo parsing |
| `src/api/cheliped.ts` | +5 public APIs: `goBack`, `goForward`, `hover`, `scroll`, `waitForSelector` |
| `src/types/api.types.ts` | Extended `ActResult.action` union with `back`, `forward`, `hover`, `scroll` |
| `cheliped-cli.mjs` | +5 CLI commands: `back`, `forward`, `hover`, `scroll`, `wait-for` |
| `SKILL.md` | Updated command table |
| `README.md` | Updated command table |
| `tests/fixtures/test-features.html` | New test page |
| `tests/integration/new-features.test.ts` | 19 new tests |

---

## v0.1.0

Initial release with core Agent DOM pipeline, observe-act loop, semantic actions, web search, real-time monitor, and download support.
