# Cheliped Browser

**Agent Browser Runtime** — Browse, observe, and interact with web pages through Chrome DevTools Protocol (CDP), designed for AI agents.

Cheliped gives AI agents a structured, token-efficient view of any web page called **Agent DOM** — a compressed, semantically grouped DOM representation where every interactive element gets a numeric ID. Agents can then click, fill, and navigate using these IDs instead of parsing raw HTML.

## Features

- **Agent DOM** — Compressed DOM with numeric IDs for every interactive element. Drastically reduces token usage compared to raw HTML.
- **UI Graph & Semantic Actions** — Automatically detects high-level actions (login, search, submit) from page structure.
- **React/SPA Compatible** — Uses native input value setters to bypass React's synthetic event system.
- **Session Persistence** — Chrome stays alive between CLI calls; reconnects via CDP port.
- **Concurrent Sessions** — Multiple agents can browse independently with isolated Chrome instances.
- **Built-in Security** — Domain allowlists, prompt injection detection, and data exfiltration guards.
- **Zero Dependencies on Puppeteer/Playwright** — Direct CDP communication over WebSocket.

## Installation

```bash
npm install cheliped-browser
```

Requires **Node.js >= 20** and **Google Chrome** installed locally.

## Quick Start

### As a Library

```typescript
import { Cheliped } from 'cheliped-browser';

const cheliped = new Cheliped({ headless: true });
await cheliped.launch();

// Navigate
await cheliped.goto('https://news.ycombinator.com');

// Get Agent DOM
const dom = await cheliped.observe();
console.log(dom.nodes);  // Interactive elements with agentId
console.log(dom.texts);  // Page text content
console.log(dom.links);  // All links with absolute URLs

// Interact using agentId from observe()
await cheliped.click(42);          // Click element
await cheliped.fill(7, 'hello');   // Type into input

// Clean up
await cheliped.close();
```

### As a CLI

All commands are passed as a JSON array:

```bash
node cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'
```

The first call launches Chrome automatically and saves a session file. Subsequent calls reconnect to the same Chrome instance.

## CLI Commands

| Command | Description | Returns |
|---------|-------------|---------|
| `launch` | Explicitly start Chrome (usually auto-started) | `{ success }` |
| `goto` | Navigate to a URL | `{ success, url, title }` |
| `observe` | Extract Agent DOM with numeric IDs | `{ nodes, texts, links }` |
| `observe-graph` | Get UI graph (nodes, edges, forms) | `{ nodes, edges, forms }` |
| `actions` | Detect semantic actions (login, search, etc.) | `[{ id, type, label, confidence, params }]` |
| `click` | Click an element by agentId | `{ success, action, agentId }` |
| `fill` | Type text into an input by agentId | `{ success, action, agentId }` |
| `perform` | Execute a semantic action by ID | `{ success, actionId, actionType }` |
| `screenshot` | Save current page as PNG | `{ success, path, size }` |
| `run-js` | Execute JavaScript in page context | `{ success, result }` |
| `extract` | Extract text, links, or all data | `{ type, data }` |
| `close` | Quit Chrome and delete session | `{ success }` |

## The Observe-Act Loop

The core pattern for AI agent interaction:

```
1. goto <url>       → Load the page
2. observe          → Extract Agent DOM, get agentIds
3. Identify the agentId of the target element
4. click / fill     → Perform the action
5. observe          → Re-observe the changed page
6. Repeat
```

### Example: Search on Hacker News

```bash
# Navigate and observe
node cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://news.ycombinator.com"]},
  {"cmd":"observe"}
]'

# Find the search input agentId from observe output, then:
node cheliped-cli.mjs '[
  {"cmd":"fill","args":["3","AI agents"]},
  {"cmd":"click","args":["4"]},
  {"cmd":"observe"}
]'
```

### Example: Semantic Actions (High-Level)

```bash
# Discover available actions on a page
node cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com/login"]},
  {"cmd":"actions"}
]'

# Execute an action with parameters
node cheliped-cli.mjs '[
  {"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass123"}}
]'
```

## Concurrent Usage

When multiple agents need to browse simultaneously, use the `--session` flag to isolate each agent's Chrome instance:

```bash
# Agent 1
node cheliped-cli.mjs --session agent1 '[{"cmd":"goto","args":["https://example.com"]}]'

# Agent 2 (independent Chrome process)
node cheliped-cli.mjs --session agent2 '[{"cmd":"goto","args":["https://other.com"]}]'

# Clean up individual sessions
node cheliped-cli.mjs --session agent1 '[{"cmd":"close"}]'
node cheliped-cli.mjs --session agent2 '[{"cmd":"close"}]'
```

Each session gets its own session file (`/tmp/cheliped-session-<name>.json`) and Chrome process.

## Architecture

```
src/
├── api/          # Cheliped main API class
├── browser/      # Chrome process controller
├── cdp/          # CDP connection, transport, launcher
├── dom/          # Agent DOM builder, extractor, filter, compressor
├── graph/        # UI graph builder, semantic action generator
├── security/     # Domain allowlist, prompt injection, exfiltration guard
├── session/      # Cookie persistence, session management
└── types/        # TypeScript type definitions
```

### Key Concepts

- **CDPTransport** — Raw WebSocket JSON-RPC communication with Chrome.
- **AgentDomBuilder** — Transforms the full DOM tree into a compressed, grouped representation. Each interactive element (buttons, inputs, links, selects) gets a unique `agentId`.
- **UIGraphBuilder** — Builds a semantic graph from DOM elements, identifying relationships between form fields, labels, and submit buttons.
- **ActionGenerator** — Analyzes the UI graph to detect high-level actions (login forms, search bars, navigation) with confidence scores.
- **TokenCompressor** — Truncates text content and limits link counts to minimize LLM token consumption.

## Programmatic API

```typescript
import { Cheliped } from 'cheliped-browser';

const cheliped = new Cheliped({
  headless: true,
  compression: { enabled: true, maxTextLength: 120, maxLinks: 50 },
  // security: { allowedDomains: ['example.com'], enablePromptGuard: true },
  // session: { profileName: 'my-session', persistCookies: true },
});

await cheliped.launch();

// Navigation
const page = await cheliped.goto('https://example.com');
// page.url, page.title

// Observation
const dom = await cheliped.observe();           // Agent DOM
const graph = await cheliped.observeGraph();     // UI Graph
const actions = await cheliped.actions();        // Semantic actions

// Interaction
await cheliped.click(agentId);                   // Click
await cheliped.fill(agentId, 'text');             // Fill input
await cheliped.perform('action-id', { key: 'value' }); // Semantic action

// Utilities
const screenshot = await cheliped.screenshot();  // PNG buffer
const result = await cheliped.runJs('document.title'); // Run JS
const data = await cheliped.extract('links');     // Extract data

// Session management
await cheliped.detach();    // Disconnect WebSocket, keep Chrome alive
await cheliped.reconnect(port); // Reconnect to existing Chrome
await cheliped.close();     // Full shutdown
```

## Agent DOM Output Example

```json
{
  "nodes": [
    { "id": 1, "tag": "input", "type": "text", "name": "q", "text": "" },
    { "id": 2, "tag": "button", "text": "Search" },
    { "id": 3, "tag": "a", "text": "About", "href": "https://example.com/about" }
  ],
  "texts": [
    "Welcome to Example",
    "Search the web..."
  ],
  "links": [
    { "text": "About", "href": "https://example.com/about" },
    { "text": "Contact", "href": "https://example.com/contact" }
  ]
}
```

## Tips

- **React/SPA sites**: The `fill` command uses native input value setters to bypass React's synthetic event system, ensuring compatibility with React-controlled components.
- **Token efficiency**: Agent DOM is compressed by default. `observe` output uses significantly fewer tokens than raw HTML.
- **agentId validity**: `agentId` values are only valid after calling `observe` or `observe-graph`. Re-observe after page changes.
- **Session persistence**: Chrome stays alive in the background until `close` is called. No need to restart between sequential commands.

## Using as a Claude Code / OpenClaw Skill

Cheliped can be registered as a skill for [Claude Code](https://claude.ai/claude-code) or [OpenClaw](https://openclaw.ai), enabling AI agents to browse the web autonomously.

Install the skill:

```bash
# Copy skill files
cp -r skills/cheliped-browser ~/.claude/skills/cheliped-browser
cp -r skills/cheliped-browser ~/.openclaw/skills/cheliped-browser
```

Once installed, the AI agent can use `/cheliped-browser` or be triggered automatically when browsing tasks are detected.

## Output Format

All CLI commands output JSON to stdout.

**Success:**
```json
[
  { "cmd": "goto", "result": { "success": true, "url": "...", "title": "..." } },
  { "cmd": "observe", "result": { "nodes": [], "texts": [], "links": [] } }
]
```

**Error:**
```json
{ "error": "Error message", "command": "failed-command" }
```

## Development

```bash
# Build
npm run build

# Run tests
npm test

# Run integration tests (requires Chrome)
npm run test:integration
```

## License

MIT
