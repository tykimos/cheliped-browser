# Changelog

## v0.2.0 (2026-03-23)

### New Commands

- **`back` / `forward`** — Browser history navigation. Navigate back and forward without re-entering URLs.
- **`hover`** — Hover over elements by agentId. Triggers dropdown menus, tooltips, and hover-dependent UI.
- **`scroll`** — Pixel-level page scrolling in any direction (`up`/`down`/`left`/`right`). Essential for infinite-scroll pages and content below the fold.
- **`wait-for`** — Wait for a CSS selector to appear in the DOM with configurable timeout. Critical for SPA apps with async rendering.

### Enhancements

- **Keyboard combinations** — `press-key` now supports modifier combos: `ctrl+a`, `shift+tab`, `ctrl+shift+k`, `meta+c`, etc. Enables select-all, copy/paste, and other shortcuts.

### Summary

These additions significantly expand the agent's ability to interact with modern web applications — handling hover menus, infinite scrolling, async content loading, browser navigation, and keyboard shortcuts that were previously impossible.

---

## v0.1.0

Initial release with core Agent DOM pipeline, observe-act loop, semantic actions, web search, real-time monitor, and download support.
