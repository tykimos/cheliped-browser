<div align="center">

# 🦀 Cheliped Browser

**Give your AI agent real eyes on the web.**

[![MIT License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE.txt)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-skill-ff6b35?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0id2hpdGUiLz48L3N2Zz4=)]()
[![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-e44d26?style=for-the-badge)]()

*Browse · Observe · Click · Fill · Extract — all from the terminal.*

[Getting Started](#-getting-started) · [How It Works](#-how-it-works) · [Commands](#-commands) · [Examples](#-examples) · [Architecture](#-architecture)

</div>

---

## What is this?

Cheliped is a **browser automation skill** for AI agents. It controls Chrome via the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) and exposes an LLM-friendly view of web pages called **Agent DOM** — a compressed, semantically structured representation where every interactive element gets a numeric ID.

> **Why "Cheliped"?** — A cheliped is a crab's claw. 🦀 This tool is the claw that lets your AI agent grab things from the web.

### Highlights

- 🔍 **Agent DOM** — Compressed DOM with numeric IDs. Far fewer tokens than raw HTML.
- 🧠 **Semantic Actions** — Auto-detects login forms, search bars, navigation from page structure.
- ⚛️ **React/SPA Ready** — Native input value setters bypass React's synthetic events.
- 🔄 **Session Persistence** — Chrome stays alive between calls. No restart overhead.
- 🔀 **Concurrent Sessions** — Multiple agents browse independently with `--session`.
- 🔒 **Built-in Security** — Domain allowlists, prompt injection detection, exfiltration guards.
- 📦 **Zero Puppeteer/Playwright** — Direct CDP over WebSocket. Two npm dependencies.

---

## 🚀 Getting Started

### As a Claude Code Skill

```bash
git clone https://github.com/tykimos/cheliped-browser.git ~/.claude/skills/cheliped-browser
cd ~/.claude/skills/cheliped-browser/scripts && npm install && npm run build
```

That's it. Claude Code will automatically use this skill when browsing tasks are detected.

### As an OpenClaw Skill

```bash
git clone https://github.com/tykimos/cheliped-browser.git ~/.openclaw/skills/cheliped-browser
cd ~/.openclaw/skills/cheliped-browser/scripts && npm install && npm run build
```

---

## 🧩 How It Works

Every interaction follows the **Observe-Act Loop**:

```
  goto         observe        act          observe
   │              │            │              │
   ▼              ▼            ▼              ▼
┌──────┐    ┌──────────┐   ┌──────┐    ┌──────────┐
│ Load │───▶│ Agent DOM│──▶│click │───▶│ Agent DOM│──▶ ...
│ page │    │ + IDs    │   │fill  │    │ (updated)│
└──────┘    └──────────┘   └──────┘    └──────────┘
```

1. **`goto`** a URL → page loads
2. **`observe`** → get Agent DOM with numeric `agentId` for every interactive element
3. **`click`** / **`fill`** using the `agentId`
4. **`observe`** again → see the result
5. Repeat until done

```bash
# Navigate and see what's on the page
node scripts/cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'

# Interact using agentIds from observe output
node scripts/cheliped-cli.mjs '[{"cmd":"fill","args":["3","hello"]},{"cmd":"click","args":["4"]}]'
```

---

## 📋 Commands

All commands are passed as a JSON array to the CLI:

```bash
node scripts/cheliped-cli.mjs '[{"cmd":"<command>","args":["..."]}]'
```

| Command | Args | What it does |
|:--------|:-----|:-------------|
| `goto` | `["url"]` | Navigate to URL, wait for load |
| `observe` | — | Extract Agent DOM with agentIds |
| `click` | `["agentId"]` | Click an element |
| `fill` | `["agentId", "text"]` | Type into an input field |
| `screenshot` | `["path"]` | Capture page as PNG |
| `run-js` | `["expr"]` | Execute JS in page context |
| `extract` | `["text"∣"links"∣"all"]` | Pull structured data |
| `actions` | — | Auto-detect semantic actions |
| `perform` | `["actionId"]` | Execute a semantic action |
| `observe-graph` | — | Get UI graph (nodes + edges) |
| `close` | — | Kill Chrome, delete session |

---

## 💡 Examples

### Browse Hacker News

```bash
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://news.ycombinator.com"]},
  {"cmd":"observe"}
]'
```

<details>
<summary>📄 Sample Agent DOM output</summary>

```json
{
  "nodes": [
    { "id": 1, "tag": "a", "text": "Hacker News", "href": "https://news.ycombinator.com" },
    { "id": 2, "tag": "input", "type": "text", "name": "q" },
    { "id": 3, "tag": "button", "text": "Search" }
  ],
  "texts": ["Hacker News", "new | past | comments | ask | show | jobs"],
  "links": [
    { "text": "new", "href": "https://news.ycombinator.com/newest" }
  ]
}
```

</details>

### Login with Semantic Actions

```bash
# Discover what actions are available
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com/login"]},
  {"cmd":"actions"}
]'

# Execute login with parameters
node scripts/cheliped-cli.mjs '[
  {"cmd":"perform","args":["login-form"],"params":{"email":"me@example.com","password":"secret"}}
]'
```

### Take a Screenshot

```bash
node scripts/cheliped-cli.mjs '[
  {"cmd":"goto","args":["https://example.com"]},
  {"cmd":"screenshot","args":["/tmp/page.png"]}
]'
```

### Run Multiple Agents

```bash
# Each agent gets its own Chrome instance
node scripts/cheliped-cli.mjs --session research '[{"cmd":"goto","args":["https://arxiv.org"]}]'
node scripts/cheliped-cli.mjs --session shopping '[{"cmd":"goto","args":["https://amazon.com"]}]'
```

---

## 🏗 Architecture

```
cheliped-browser/
├── SKILL.md                    # Skill definition
├── LICENSE.txt                 # MIT
└── scripts/
    ├── cheliped-cli.mjs        # CLI entry point
    ├── src/
    │   ├── api/                # Cheliped class — main API
    │   ├── cdp/                # CDP connection + transport + launcher
    │   ├── dom/                # Agent DOM builder, extractor, compressor
    │   ├── graph/              # UI graph + semantic action generator
    │   ├── security/           # Domain allowlist, prompt guard
    │   └── session/            # Cookie persistence
    ├── tests/                  # Unit + integration tests
    └── examples/               # Demo scripts
```

### How the Agent DOM pipeline works

```
Raw DOM Tree
    │
    ▼
┌─────────────┐     ┌────────────┐     ┌──────────────┐     ┌────────────┐
│  Extractor  │────▶│   Filter   │────▶│  Semantic    │────▶│ Compressor │
│ (full tree) │     │ (visible)  │     │ (group+label)│     │ (truncate) │
└─────────────┘     └────────────┘     └──────────────┘     └────────────┘
                                                                   │
                                                                   ▼
                                                            ┌────────────┐
                                                            │ Agent DOM  │
                                                            │ {nodes,    │
                                                            │  texts,    │
                                                            │  links}    │
                                                            └────────────┘
```

---

## 📊 Benchmark

> **Date**: 2025-03-17 · **Versions**: Cheliped 1.0.0, agent-browser 0.20.14, Playwright 1.58.2, Puppeteer 22.15.0
> **Sites**: Hacker News, Wikipedia, GitHub Trending, Example.com, React TodoMVC (SPA), MDN Web Docs · **Environment**: macOS, Node.js 24, Chrome

### Token Efficiency

| Site | Raw HTML | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|---------:|--------------:|-----------:|----------:|
| Hacker News | 8,759 | **2,583** | 15,382 | 10,113 | 4,816 |
| Wikipedia | 70,651 | **3,276** | 39,769 | 15,032 | 20,039 |
| GitHub | 131,003 | 3,852 | 4,180 | 2,345 | **1,593** |
| Example.com | 132 | 111 | 120 | **58** | 71 |
| React (SPA) | 278 | 530 | 1,016 | 488 | **100** |
| MDN Web Docs | 24,929 | **2,884** | 11,203 | 5,901 | 3,717 |
| **Average** | **39,292** | **2,206** | **11,945** | **5,656** | **5,056** |

### Speed — DOM Extraction

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **37ms** | 228ms | 135ms | 106ms |
| Wikipedia | **69ms** | 293ms | 608ms | 300ms |
| GitHub | **54ms** | 207ms | 308ms | 132ms |
| Example.com | **11ms** | 282ms | 80ms | 37ms |
| React (SPA) | **3ms** | 230ms | 42ms | 11ms |
| MDN Web Docs | **32ms** | 314ms | 172ms | 160ms |
| **Average** | **34ms** | **259ms** | **224ms** | **124ms** |

### Content Recognition Quality

> Ground truth collected via Playwright `page.evaluate()` (visible elements, computed styles).
> Scoring: Text 25% + Link Recall 20% + Link Precision 10% + Button 15% + Input 15% + Heading 15%

| Metric | Cheliped | agent-browser | Playwright | Puppeteer |
|:-------|--------:|--------------:|-----------:|----------:|
| Text Recall | **81.7%** | 77.5% | 76.6% | 75.9% |
| Link Recall | **97.3%** | 84.9% | 84.3% | 83.1% |
| Link Precision | 85.6% | **90.1%** | 87.8% | 87.1% |
| Button Recall | **97.9%** | 92.3% | 82.4% | 55.1% |
| Input Recall | **79.8%** | 1.2% | 33.3% | 50.0% |
| Heading Recall | **89.1%** | 88.1% | 86.4% | 86.7% |
| **Overall** | **88.4%** | **72.6%** | **75.1%** | **73.1%** |

<details>
<summary>📋 Per-site detail: Button / Input / Heading detection</summary>

**Button Detection** (found / ground-truth)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Wikipedia | **21/22** | 21/22 | 8/22 | 3/22 |
| GitHub | **11/12** | 7/12 | 7/12 | 2/12 |
| MDN Web Docs | **8/8** | 8/8 | 8/8 | 0/8 |

**Input Field Detection** (found / ground-truth)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **1/1** | 0/1 | 0/1 | 0/1 |
| Wikipedia | **11/14** | 1/14 | 0/14 | 0/14 |
| React (SPA) | **1/1** | 0/1 | 0/1 | 0/1 |

**Heading Detection** (found / ground-truth)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Wikipedia | **11/12** | **12/12** | **12/12** | 11/12 |
| GitHub | **6/14** | 4/14 | 4/14 | 4/14 |
| MDN Web Docs | **10/10** | **10/10** | 9/10 | **10/10** |
| React (SPA) | **2/2** | **2/2** | **2/2** | **2/2** |

</details>

---

## ⚖️ Honest Assessment

### Strengths

- **Token efficiency is real** — 2.5–5x fewer tokens than competitors on average, directly reducing LLM API costs.
- **Fastest DOM extraction** — 34ms average, 3.6–7.6x faster than alternatives.
- **Best content recognition** — 88.4% overall quality score across 6 diverse sites.
- **Agent DOM is purpose-built** — Numbered interactive elements with semantic grouping (buttons, links, inputs, forms) are directly actionable by LLM agents.
- **Zero framework dependencies** — Just `ws` for WebSocket. No Playwright/Puppeteer required.
- **React/SPA fill support** — Native input value setters bypass synthetic event systems.
- **Session persistence** — Browser survives between agent invocations.

### Known Limitations

- **GitHub text recall is low (37%)** — Aggressive compression (`maxListItems: 30`) still truncates long lists. Trade-off: more tokens vs more content.
- **React SPA token inflation** — On very small SPAs like TodoMVC, Cheliped's structured output (530 tok) is larger than Puppeteer's a11y snapshot (100 tok). The overhead pays off on larger pages.
- **No auto-wait for SPA updates** — After `click()`, the agent must manually call `observe()` again. No built-in `waitForSelector` or `waitForNavigation` like Playwright.
- **Benchmark methodology caveats**:
  - Token estimation uses `chars/4`, not a real tokenizer — favors compact JSON slightly.
  - Playwright/Puppeteer are benchmarked via a11y snapshots, not their primary CSS selector APIs.
  - 6 test sites may not represent all web patterns (no Shadow DOM, heavy iframe, or WebSocket-driven sites tested).

### Comparison Summary

| | Cheliped | agent-browser | Playwright | Puppeteer |
|:--|:---------|:--------------|:-----------|:----------|
| **Best for** | LLM agent browsing | CLI automation | Full browser testing | Headless scripting |
| **Avg Tokens** | **2,206** | 11,945 | 5,656 | 5,056 |
| **Avg Speed** | **34ms** | 259ms | 224ms | 124ms |
| **Quality** | **88.4%** | 72.6% | 75.1% | 73.1% |
| **Dependencies** | ws only | Rust binary | Full framework | Full framework |
| **SPA Support** | Basic | Basic | Excellent | Good |
| **Wait Strategy** | Manual | Manual | Auto-wait | Manual |
| **Production Maturity** | Early | Stable | Mature | Mature |

<details>
<summary>🔧 Run the benchmarks yourself</summary>

```bash
cd scripts
npm install
npm run build
node benchmark-compare.mjs   # Token efficiency & speed
node benchmark-quality.mjs   # Content recognition quality
```

</details>

---

## 🛠 Development

```bash
cd scripts
npm install           # Install dependencies
npm run build         # Build TypeScript → dist/
npm test              # Run unit tests
npm run test:integration  # Integration tests (needs Chrome)
```

---

## 📜 License

MIT — do whatever you want with it.

---

<div align="center">

**Built for agents that need to see the web.** 🦀

[Report a Bug](https://github.com/tykimos/cheliped-browser/issues) · [Request a Feature](https://github.com/tykimos/cheliped-browser/issues)

</div>
