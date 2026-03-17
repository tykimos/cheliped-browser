# Cheliped Browser

**Agent Browser Runtime** — Give your AI agent the ability to browse, observe, and interact with any web page.

Cheliped is a browser automation skill for [Claude Code](https://claude.ai/claude-code) and [OpenClaw](https://openclaw.ai). It controls Chrome via the Chrome DevTools Protocol (CDP) and exposes an LLM-friendly view of web pages called **Agent DOM** — a compressed, semantically structured representation that strips visual noise and reduces token usage.

## Install as a Claude Code Skill

```bash
# The repo IS the skill - just clone and register
git clone https://github.com/tykimos/cheliped-browser.git ~/.claude/skills/cheliped-browser
cd ~/.claude/skills/cheliped-browser && npm install && npm run build
```

Once installed, Claude Code can browse the web using the `/cheliped-browser` command or automatically when browsing tasks are detected.

## How It Works

All browser interactions go through `scripts/cheliped-cli.mjs`. Each call accepts a JSON array of commands:

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'
```

- First call **launches Chrome** automatically and saves a session file
- Subsequent calls **reconnect** to the same Chrome instance
- Call `close` when done to terminate Chrome

## The Observe-Act Loop

The core pattern for AI agent web interaction:

```
1. goto <url>       → Load the page
2. observe          → Extract Agent DOM with numeric agentIds
3. Identify target element's agentId
4. click / fill     → Perform the action
5. observe          → Re-observe the changed page
6. Repeat until goal is achieved
```

### Example: Search on Hacker News

```bash
# Navigate and observe the page
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://news.ycombinator.com"]},
  {"cmd":"observe"}
]'

# Use agentId from observe output to fill search and click
node scripts/cheliped-cli.mjs '[
  {"cmd":"fill","args":["3","AI agents"]},
  {"cmd":"click","args":["4"]},
  {"cmd":"observe"}
]'
```

### Example: Using Semantic Actions

```bash
# Discover available actions on a login page
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com/login"]},
  {"cmd":"actions"}
]'

# Execute the login action with parameters
node scripts/cheliped-cli.mjs '[
  {"cmd":"perform","args":["login-form"],"params":{"email":"user@example.com","password":"pass123"}}
]'
```

## Available Commands

| Command | Description | Returns |
|---------|-------------|---------|
| `goto` | Navigate to a URL, wait for page load | `{ success, url, title }` |
| `observe` | Extract Agent DOM with numeric IDs for every interactive element | `{ nodes, texts, links }` |
| `observe-graph` | Get semantic UI graph (nodes, edges, forms) | `{ nodes, edges, forms }` |
| `actions` | Auto-detect high-level actions (login, search, submit) | `[{ id, type, label, confidence }]` |
| `click` | Click an element by its agentId | `{ success, action, agentId }` |
| `fill` | Type text into an input field by agentId | `{ success, action, agentId }` |
| `perform` | Execute a semantic action with parameters | `{ success, actionId, actionType }` |
| `screenshot` | Capture current page as PNG | `{ success, path, size }` |
| `run-js` | Execute JavaScript in page context | `{ success, result }` |
| `extract` | Extract text, links, or all page data | `{ type, data }` |
| `close` | Terminate Chrome and delete session | `{ success }` |

## Concurrent Sessions

Multiple agents can browse simultaneously with isolated Chrome instances:

```bash
node scripts/cheliped-cli.mjs --session agent1 '[{"cmd":"goto","args":["https://site-a.com"]}]'
node scripts/cheliped-cli.mjs --session agent2 '[{"cmd":"goto","args":["https://site-b.com"]}]'
```

Each session gets its own Chrome process and session file (`/tmp/cheliped-session-<name>.json`).

## Key Features

- **Agent DOM** — Compressed DOM where every interactive element gets a numeric ID. Uses far fewer tokens than raw HTML.
- **Semantic Actions** — Auto-detects login forms, search bars, and navigation patterns from page structure.
- **React/SPA Compatible** — Uses native input value setters to work with React controlled components.
- **Session Persistence** — Chrome stays alive between CLI calls; reconnects automatically.
- **Zero Puppeteer/Playwright** — Direct CDP communication over WebSocket. Minimal dependencies.
- **Built-in Security** — Domain allowlists, prompt injection detection, data exfiltration guards.

## Agent DOM Output

```json
{
  "nodes": [
    { "id": 1, "tag": "input", "type": "text", "name": "q", "text": "" },
    { "id": 2, "tag": "button", "text": "Search" },
    { "id": 3, "tag": "a", "text": "About", "href": "https://example.com/about" }
  ],
  "texts": ["Welcome to Example", "Search the web..."],
  "links": [
    { "text": "About", "href": "https://example.com/about" }
  ]
}
```

## Architecture

```
cheliped-browser/          # This IS the skill folder
├── SKILL.md               # Skill definition (root level)
├── scripts/
│   └── cheliped-cli.mjs   # CLI wrapper
├── src/                   # TypeScript source
│   ├── api/               # Cheliped main API class
│   ├── cdp/               # CDP connection, transport, Chrome launcher
│   ├── dom/               # Agent DOM builder, extractor, filter, compressor
│   ├── graph/             # UI graph builder, semantic action generator
│   ├── security/          # Domain allowlist, prompt injection guard
│   └── session/           # Cookie persistence, session management
├── tests/                 # Unit and integration tests
└── examples/              # Usage examples
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Build to dist/
npm test             # Run unit tests
npm run test:integration  # Run integration tests (requires Chrome)
```

## Using as a Library

Cheliped can also be used programmatically:

```typescript
import { Cheliped } from 'cheliped-browser';

const cheliped = new Cheliped({ headless: true });
await cheliped.launch();
await cheliped.goto('https://example.com');

const dom = await cheliped.observe();
await cheliped.click(dom.nodes[0].id);
await cheliped.fill(7, 'hello');

await cheliped.close();
```

## License

MIT
