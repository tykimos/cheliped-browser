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

## 📊 Benchmark — Competitive Comparison

> **Date**: 2025-03-17 · **Versions**: Cheliped 1.0.0, agent-browser 0.20.14, Playwright 1.58.2, Puppeteer 22.15.0
> **Sites**: Hacker News, Wikipedia, GitHub Trending, Example.com · **Environment**: macOS, Node.js 24, Chrome

### Token Efficiency (output tokens for LLM consumption)

| Site | Raw HTML | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|---------:|--------------:|-----------:|----------:|
| Hacker News | 8,629 | **2,294** | 15,127 | 9,942 | 4,729 |
| Wikipedia | 71,138 | **4,008** | 39,475 | 15,417 | 19,744 |
| GitHub | 130,052 | 3,323 | 4,180 | 2,345 | **1,593** |
| Example.com | 132 | 108 | 120 | **58** | 71 |
| **Average** | **52,488** | **2,433** | **14,726** | **6,941** | **6,534** |

### Compression Ratio (% token reduction vs Raw HTML)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **73.4%** | -75.3% | -15.2% | 45.2% |
| Wikipedia | **94.4%** | 44.5% | 78.3% | 72.2% |
| GitHub | 97.4% | 96.8% | **98.2%** | 98.8% |
| Example.com | 18.2% | 9.1% | **56.1%** | 46.2% |

### Speed — DOM Extraction

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | 148ms | 333ms | 184ms | **157ms** |
| Wikipedia | **172ms** | 482ms | 338ms | 260ms |
| GitHub | **106ms** | 253ms | 342ms | 148ms |
| Example.com | 162ms | 280ms | 99ms | **9ms** |
| **Average** | **147ms** | **337ms** | **241ms** | **143ms** |

### Interactive Elements Detected

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | 50 | 0 | 1 | 510 |
| Wikipedia | 99 | 0 | 5 | 1,194 |
| GitHub | 90 | 0 | 5 | 113 |
| Example.com | 1 | 0 | 3 | 4 |

### Summary

| Metric | Cheliped | agent-browser | Playwright | Puppeteer |
|:-------|:---------|:--------------|:-----------|:----------|
| **Avg Tokens** | **2,433** | 14,726 | 6,941 | 6,534 |
| **Avg Extract** | **147ms** | 337ms | 241ms | 143ms |
| **Launch Time** | 8.7s | 7.6s | **1.4s** | 3.7s |
| **Dependencies** | ws only | Rust binary | Full framework | Full framework |

**Key takeaways:**

- Cheliped produces **2.7–6x fewer tokens** than all competitors — directly reducing LLM API costs.
- Extraction speed is on par with Puppeteer and **2x faster than agent-browser**.
- Puppeteer over-counts elements (510–1,194) because it includes all a11y nodes; Cheliped returns only **actionable interactive elements** (50–99).
- agent-browser detects **zero** interactive elements via its snapshot format.
- Cheliped has **zero framework dependencies** — just `ws` for WebSocket.

### Content Recognition Quality

> How accurately does each tool capture **real page content**?
> Ground truth collected via Playwright `page.evaluate()` (visible elements, computed styles).

**Ground Truth (actual visible content on each site)**

| Site | Visible Texts | Links | Buttons | Inputs | Headings |
|:-----|-------------:|------:|--------:|-------:|---------:|
| Hacker News | 250 | 198 | 0 | 1 | 0 |
| Wikipedia | 1,370 | 500 | 22 | 14 | 12 |
| GitHub | 1,087 | 45 | 12 | 0 | 14 |
| Example.com | 3 | 1 | 0 | 0 | 1 |

**Text Recall** (% of visible text fragments recognized)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | 89.5% | 89.5% | 89.5% | 89.5% |
| Wikipedia | 78.0% | **92.5%** | 90.0% | 90.0% |
| GitHub | **25.0%** | 12.0% | 12.0% | 8.5% |
| Example.com | 100.0% | 100.0% | 100.0% | 100.0% |

**Link Detection** (Recall / Precision)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **100% / 100%** | 100% / 100% | 99% / 88% | 99% / 86% |
| Wikipedia | 84% / **100%** | 84% / 95% | 84% / 95% | 84% / 95% |
| GitHub | **100% / 54%** | 78% / 45% | 78% / 45% | 73% / 44% |
| Example.com | **100% / 100%** | 100% / 100% | 100% / 100% | 100% / 100% |

**Button Detection** (found / ground-truth)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Wikipedia | **21/22** | 21/22 | 8/22 | 3/22 |
| GitHub | **11/12** | 7/12 | 7/12 | 2/12 |

**Input Field Detection** (found / ground-truth)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **1/1** | 0/1 | 0/1 | 0/1 |
| Wikipedia | **11/14** | 1/14 | 0/14 | 0/14 |

### Overall Quality Score

Weighted: Text Recall 30% + Link Recall 25% + Link Precision 15% + Button Recall 15% + Input Recall 15%

| Metric | Cheliped | agent-browser | Playwright | Puppeteer |
|:-------|--------:|--------------:|-----------:|----------:|
| Text Recall | 73.1% | **73.5%** | 72.9% | 72.0% |
| Link Recall | **95.9%** | 90.3% | 90.1% | 89.0% |
| Link Precision | **88.6%** | 85.2% | 82.0% | 81.2% |
| Button Recall | **96.8%** | 88.4% | 73.7% | 57.6% |
| Input Recall | **69.6%** | 1.8% | 50.0% | 50.0% |
| **Overall** | **84.2%** | 70.9% | 75.2% | 72.2% |

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
