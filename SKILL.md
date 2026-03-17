---
name: cheliped-browser
description: "Agent Browser Runtime — browse, observe, and interact with any web page via Chrome DevTools Protocol (CDP). Use this skill when the agent needs to navigate websites, extract page content, fill forms, click buttons, take screenshots, or perform any browser-based task."
version: 1.0.0
license: MIT
---

# cheliped-browser — Agent Browser Runtime

Cheliped controls Chrome via the Chrome DevTools Protocol (CDP) and exposes an LLM-friendly view of web pages called **Agent DOM** — a compressed, semantically structured representation where every interactive element gets a numeric ID (`agentId`).

## Quick Start

All browser interactions go through the CLI wrapper. Each invocation accepts a JSON array of commands:

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'
```

The first call launches Chrome automatically and saves a session. Subsequent calls reconnect to the same Chrome instance. Call `close` when done.

**Always run the CLI from the skill's root directory.**

## Setup

Before first use, install dependencies and build:

```bash
npm install && npm run build
```

## The Observe-Act Loop

The core pattern for interacting with any web page:

```
1. goto <url>       → Load the page
2. observe          → Extract Agent DOM, get agentIds
3. Identify the agentId of the target element
4. click / fill     → Perform the action
5. observe          → Re-observe the changed page
6. Repeat until goal is achieved
```

## Available Commands

### `goto`
Navigate to a URL. Waits for page load to complete.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://news.ycombinator.com"]}]'
```
Returns: `{ success: true, url, title }`

### `observe`
Extract the current page's **Agent DOM**. Each interactive element gets a numeric `agentId`.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"observe"}]'
```
Returns: `{ nodes: [...], texts: [...], links: [...] }` — Use `nodes[].id` with `click`/`fill`.

### `observe-graph`
Get the page's **UI Graph** — a semantic structure of nodes, edges, and form groups.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"observe-graph"}]'
```
Returns: `{ nodes: [...], edges: [...], forms: [...] }`

### `actions`
Get a list of **semantic actions** available on the page. Automatically detects login forms, search bars, submit buttons, etc.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"actions"}]'
```
Returns: `[{ id, type, label, confidence, params, triggerNodeId }, ...]`

### `click`
Click an element by its Agent DOM ID. Must call `observe` or `observe-graph` first.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"click","args":["42"]}]'
```
Returns: `{ success: true, action: "click", agentId: 42 }`

### `fill`
Type text into an input field by its Agent DOM ID. Works with React/SPA apps.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"observe"},{"cmd":"fill","args":["7","hello world"]}]'
```
Returns: `{ success: true, action: "fill", agentId: 7 }`

### `perform`
Execute a semantic action by its ID. Use with parameters from `actions` output.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass123"}}]'
```
Returns: `{ success: true, actionId, actionType }`

### `screenshot`
Save the current screen as PNG. Defaults to `/tmp/cheliped-screenshot.png`.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"screenshot","args":["/tmp/page.png"]}]'
```
Returns: `{ success: true, path: "/tmp/page.png", size: 12345 }`

### `run-js`
Execute JavaScript in the page context and return the result.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"run-js","args":["document.title"]}]'
```
Returns: `{ success: true, result: "Page Title" }`

### `extract`
Extract specific data from the page. Types: `text`, `links`, `all`.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"extract","args":["links"]}]'
```
Returns: `{ type: "links", data: [...] }`

### `close`
Terminate Chrome and delete the session file.
```bash
node scripts/cheliped-cli.mjs '[{"cmd":"close"}]'
```

## Concurrent Sessions

When multiple agents need to browse simultaneously, use `--session` to isolate each Chrome instance:

```bash
node scripts/cheliped-cli.mjs --session agent1 '[{"cmd":"goto","args":["https://site-a.com"]}]'
node scripts/cheliped-cli.mjs --session agent2 '[{"cmd":"goto","args":["https://site-b.com"]}]'
```

Each session gets its own Chrome process and session file.

## Examples

### Search on Hacker News

```bash
# Navigate and observe
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://news.ycombinator.com"]},
  {"cmd":"observe"}
]'

# Fill search input (agentId 3) and click search button (agentId 4)
node scripts/cheliped-cli.mjs '[
  {"cmd":"fill","args":["3","AI agents"]},
  {"cmd":"click","args":["4"]},
  {"cmd":"observe"}
]'
```

### Login with Semantic Actions

```bash
# Discover actions on a login page
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com/login"]},
  {"cmd":"actions"}
]'

# Execute the login action with parameters
node scripts/cheliped-cli.mjs '[
  {"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass123"}}
]'
```

## Tips

- **agentId validity**: `agentId` values are only valid after `observe` or `observe-graph`. Re-observe after page changes.
- **React/SPA sites**: `fill` uses native input value setters to bypass React's synthetic event system.
- **Token efficiency**: Agent DOM is compressed by default — far fewer tokens than raw HTML.
- **Session persistence**: Chrome stays alive until `close` is called. No restart needed between calls.

## Output Format

All commands output JSON to stdout. Success returns an array of results:
```json
[
  { "cmd": "goto", "result": { "success": true, "url": "...", "title": "..." } },
  { "cmd": "observe", "result": { "nodes": [...], "texts": [...], "links": [...] } }
]
```

Error:
```json
{ "error": "Error message", "command": "failed-command" }
```
