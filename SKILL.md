---
name: cheliped-browser
description: "Agent Browser Runtime for browsing, observing, and interacting with web pages via Chrome DevTools Protocol (CDP). Use this skill when Claude needs to: (1) navigate to and browse websites, (2) extract page content, text, or links from any URL, (3) fill forms or type into input fields, (4) click buttons or links on a page, (5) take screenshots of web pages, (6) execute JavaScript in a page context, (7) perform login or search actions on websites, (8) scrape or crawl web content, or any other browser-based task. Triggers on: browse, crawl, scrape, web page, website, navigate, open URL, screenshot a site, fill a form online, login to a site."
---

# Agent Browser Runtime

Control Chrome via CDP. Extract **Agent DOM** — a compressed DOM where every interactive element gets a numeric `agentId`.

## Setup

Run once before first use:

```bash
cd scripts && npm install && npm run build
```

## Core Workflow: Observe-Act Loop

```bash
# 1. Navigate and observe
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'

# 2. Use agentId from observe output to interact
node scripts/cheliped-cli.mjs '[{"cmd":"fill","args":["3","search term"]},{"cmd":"click","args":["4"]},{"cmd":"observe"}]'
```

First call auto-launches Chrome and saves session. Subsequent calls reconnect. Call `close` when done.

## Commands

| Command | Args | Returns |
|---------|------|---------|
| `goto` | `["url"]` | `{ success, url, title }` |
| `observe` | none | `{ nodes, texts, links }` — `nodes[].id` = agentId |
| `click` | `["agentId"]` | `{ success, action, agentId }` |
| `fill` | `["agentId", "text"]` | `{ success, action, agentId }` |
| `screenshot` | `["path"]` (optional) | `{ success, path, size }` |
| `run-js` | `["expression"]` | `{ success, result }` |
| `extract` | `["text"\|"links"\|"all"]` | `{ type, data }` |
| `actions` | none | `[{ id, type, label, params }]` |
| `perform` | `["actionId"]` + `"params":{...}` | `{ success, actionId }` |
| `observe-graph` | none | `{ nodes, edges, forms }` |
| `close` | none | `{ success }` |

## Examples

### Browse and extract content

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://news.ycombinator.com"]},{"cmd":"observe"}]'
```

### Fill a form and submit

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"fill","args":["7","hello"]},{"cmd":"click","args":["8"]}]'
```

### Semantic action (login, search)

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com/login"]},{"cmd":"actions"}]'
node scripts/cheliped-cli.mjs '[{"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass"}}]'
```

### Concurrent sessions

```bash
node scripts/cheliped-cli.mjs --session agent1 '[{"cmd":"goto","args":["https://site-a.com"]}]'
node scripts/cheliped-cli.mjs --session agent2 '[{"cmd":"goto","args":["https://site-b.com"]}]'
```

## Key Notes

- Call `observe` before `click`/`fill` — agentIds are only valid after observation.
- `fill` works with React/SPA apps (uses native input value setters).
- Agent DOM is token-compressed — far fewer tokens than raw HTML.
- Chrome persists between calls until `close`. No restart needed.
- All output is JSON to stdout. Errors: `{ "error": "message" }`.
