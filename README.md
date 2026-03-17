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

---

## ⚖️ How Does It Compare?

> Benchmarked on 16 sites (static, SPA, forms, complex, edge cases) · 2025-03-18

| | Cheliped | agent-browser | Playwright | Puppeteer |
|:--|:---------|:--------------|:-----------|:----------|
| **Best for** | LLM agent browsing | CLI automation | Full browser testing | Headless scripting |
| **Avg Tokens** | **2,206** | 11,945 | 5,656 | 5,056 |
| **Avg Speed** | **34ms** | 259ms | 224ms | 124ms |
| **Quality** | **88.4%** | 72.6% | 75.1% | 73.1% |
| **Dependencies** | ws only | Rust binary | Full framework | Full framework |
| **iframe/Shadow DOM** | No | No | Partial | Partial |
| **SPA Support** | Basic | Basic | Excellent | Good |
| **Wait Strategy** | Network idle | Manual | Auto-wait | Manual |
| **Production Maturity** | Early | Stable | Mature | Mature |

### Strengths

- **2.5–5x fewer tokens** than all competitors — directly reduces LLM API costs
- **Fastest extraction (34ms avg)** — 3.6–7.6x faster than alternatives via direct CDP
- **Best content recognition (88.4%)** — highest recall on links, buttons, inputs, headings
- **Agent DOM** — purpose-built for LLM agents: numbered interactive elements with semantic grouping
- **Zero framework dependencies** — just `ws` for WebSocket, no Playwright/Puppeteer required
- **React/SPA fill** — native input value setters bypass synthetic event systems
- **Session persistence** — Chrome stays alive between agent invocations, no restart overhead
- **Concurrent sessions** — multiple agents browse independently with `--session`

### Known Limitations

Tested on 10 edge-case sites (NPM, Reddit, YouTube, Twitter/X, Google, Stack Overflow, MDN API, W3Schools, JSONPlaceholder, HTTPBin):

- **Link cap on large pages** — `maxLinks: 500` cuts off on pages with 1,000+ links (MDN API: 500/1,230 = 41%). Configurable but adds tokens.
- **iframe / Shadow DOM blind spot** — HTTPBin (Swagger UI in iframe): buttons 0/11, inputs 0/1, headings 2/13. Cheliped cannot reach inside iframes or shadow roots. Playwright has the same limitation via ariaSnapshot.
- **Over-detection on JS-heavy pages** — NPM search: GT reports 2 links (pre-render) but Cheliped finds 105 (post-render). This is actually more accurate, but inflates token count (3,865 tok vs Playwright's 133 tok).
- **Heavy SPA navigation is slow** — Twitter/X: 12s navigation + 1.6s extraction. YouTube: 6.8s. All tools are slow on auth-walled SPAs.
- **Heading over-count on complex pages** — W3Schools: 59 headings detected vs 29 ground-truth (sidebar nav headings included). Filtering visible-only is imperfect.
- **Small SPA token overhead** — TodoMVC (278 tok raw): Cheliped 530 tok vs Puppeteer 100 tok. Structured JSON overhead only hurts on tiny pages.
- **Early-stage project** — not yet battle-tested in production. Playwright and Puppeteer have years of maturity.
- **Benchmark caveats**: token estimation uses `chars/4` (not tiktoken); Playwright/Puppeteer benchmarked via a11y snapshots, not their primary CSS selector APIs.

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

> Ground truth: actual visible elements collected via Playwright `page.evaluate()` with computed styles.
> Scoring: Text 25% + Link Recall 20% + Link Precision 10% + Button 15% + Input 15% + Heading 15%

#### Ground Truth (what's actually on each page)

| Site | Type | Visible Texts | Links | Buttons | Inputs | Headings |
|:-----|:-----|-------------:|------:|--------:|-------:|---------:|
| Hacker News | Static HTML | 250 | 198 | 0 | 1 | 0 |
| Wikipedia | Static + Forms | 1,370 | 500 | 22 | 14 | 12 |
| GitHub | SPA-like | 1,087 | 45 | 12 | 0 | 14 |
| Example.com | Minimal | 3 | 1 | 0 | 0 | 1 |
| React TodoMVC | React SPA | 23 | 11 | 0 | 1 | 2 |
| MDN Web Docs | Content-heavy | 582 | 354 | 8 | 0 | 10 |

#### Text Recall (% of visible text fragments recognized)

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | 89.0% | 89.0% | 89.0% | 89.0% |
| Wikipedia | 83.0% | **95.0%** | 90.0% | 90.0% |
| GitHub | **37.0%** | 12.0% | 12.0% | 8.5% |
| Example.com | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| React (SPA) | 91.3% | **100.0%** | **100.0%** | **100.0%** |
| MDN Web Docs | **90.0%** | 69.0% | 68.5% | 68.0% |
| **Average** | **81.7%** | 77.5% | 76.6% | 75.9% |

> Cheliped leads overall but loses on Wikipedia (compression truncates) and GitHub (list item limit).
> All tools struggle with GitHub — dynamic rendering hides content from all extraction methods.

#### Link Detection

| Site | | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|:--|--------:|--------------:|-----------:|----------:|
| Hacker News | Recall | **100%** | **100%** | 98% | 99% |
| | Precision | **100%** | **100%** | 87% | 86% |
| Wikipedia | Recall | 84% | 84% | 84% | 84% |
| | Precision | 84% | **95%** | **95%** | **95%** |
| GitHub | Recall | **100%** | 78% | 78% | 69% |
| | Precision | 34% | **45%** | **45%** | 41% |
| Example.com | Recall | **100%** | **100%** | **100%** | **100%** |
| | Precision | **100%** | **100%** | **100%** | **100%** |
| React (SPA) | Recall | **100%** | **100%** | **100%** | **100%** |
| | Precision | **100%** | **100%** | **100%** | **100%** |
| MDN Web Docs | Recall | **100%** | 48% | 46% | 46% |
| | Precision | **96%** | **100%** | **100%** | **100%** |
| **Average** | **Recall** | **97.3%** | 84.9% | 84.3% | 83.1% |
| | **Precision** | 85.6% | **90.1%** | 87.8% | 87.1% |

> Cheliped finds the most links (97.3% recall) but has lower precision on GitHub due to over-detection from expanded link extraction.

#### Button Detection (found / ground-truth buttons)

| Site | Ground Truth | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|:-----------:|--------:|--------------:|-----------:|----------:|
| Wikipedia | 22 | **21** (95%) | 21 (95%) | 8 (36%) | 3 (14%) |
| GitHub | 12 | **11** (92%) | 7 (58%) | 7 (58%) | 2 (17%) |
| MDN Web Docs | 8 | **8** (100%) | **8** (100%) | **8** (100%) | 0 (0%) |
| **Average** | | **97.9%** | 92.3% | 82.4% | 55.1% |

> Cheliped detects nearly all buttons. Puppeteer misses most — its a11y tree often classifies buttons differently.

#### Input Field Detection (found / ground-truth inputs)

| Site | Ground Truth | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|:-----------:|--------:|--------------:|-----------:|----------:|
| Hacker News | 1 | **1** (100%) | 0 (0%) | 0 (0%) | 0 (0%) |
| Wikipedia | 14 | **11** (79%) | 1 (7%) | 0 (0%) | 0 (0%) |
| React (SPA) | 1 | **1** (100%) | 0 (0%) | 0 (0%) | 0 (0%) |
| **Average** | | **79.8%** | 1.2% | 33.3% | 50.0% |

> This is Cheliped's biggest advantage. Other tools' a11y/snapshot formats lose most input fields.
> agent-browser detects 482–1,407 "inputs" per page (false positives from its text format) but matches only 1.2% of real ones.

#### Heading Detection (found / ground-truth headings)

| Site | Ground Truth | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|:-----------:|--------:|--------------:|-----------:|----------:|
| Wikipedia | 12 | 11 (92%) | **12** (100%) | **12** (100%) | 11 (92%) |
| GitHub | 14 | **6** (43%) | 4 (29%) | 4 (29%) | 4 (29%) |
| Example.com | 1 | **1** (100%) | **1** (100%) | **1** (100%) | **1** (100%) |
| React (SPA) | 2 | **2** (100%) | **2** (100%) | **2** (100%) | **2** (100%) |
| MDN Web Docs | 10 | **10** (100%) | **10** (100%) | 9 (90%) | **10** (100%) |
| **Average** | | **89.1%** | 88.1% | 86.4% | 86.7% |

> All tools perform similarly on headings. GitHub is hard for everyone (dynamic rendering hides headings).

#### Overall Quality Score

| Metric | Weight | Cheliped | agent-browser | Playwright | Puppeteer |
|:-------|------:|---------:|--------------:|-----------:|----------:|
| Text Recall | 25% | **81.7%** | 77.5% | 76.6% | 75.9% |
| Link Recall | 20% | **97.3%** | 84.9% | 84.3% | 83.1% |
| Link Precision | 10% | 85.6% | **90.1%** | 87.8% | 87.1% |
| Button Recall | 15% | **97.9%** | 92.3% | 82.4% | 55.1% |
| Input Recall | 15% | **79.8%** | 1.2% | 33.3% | 50.0% |
| Heading Recall | 15% | **89.1%** | 88.1% | 86.4% | 86.7% |
| **Overall** | **100%** | **88.4%** | **72.6%** | **75.1%** | **73.1%** |

### Edge Case & Limitation Test

> Tested on 10 additional sites targeting known weaknesses: long lists, heavy SPAs, forms, complex structure, iframes.

#### Navigation & Extraction

| Site | Category | Cheliped | Playwright | Puppeteer | Notes |
|:-----|:---------|--------:|----------:|----------:|:------|
| NPM Search | Long List | 3,865 tok / 71ms | 133 tok / 310ms | 44 tok / 60ms | Cheliped extracts post-render content (105 links); others see pre-render (2 links) |
| Reddit | Long List | 9,396 tok / 87ms | 65 tok / 72ms | 223 tok / 102ms | Similar: Cheliped renders fully, outputs more |
| YouTube | Heavy SPA | 548 tok / 102ms | 185 tok / 363ms | 1,685 tok / 28ms | All limited by consent/auth wall |
| Twitter/X | Heavy SPA | 193 tok / 1.6s | 27 tok / 1.6s | 67 tok / 1.1s | Login wall — all tools see minimal content |
| Google Search | Forms | 609 tok / 136ms | 350 tok / 91ms | 898 tok / 23ms | Cheliped finds 7 inputs vs GT 1 (hidden inputs exposed) |
| Stack Overflow | Forms | 1,648 tok / 111ms | 143 tok / 139ms | 44 tok / 35ms | Login required — Cheliped extracts nav elements |
| MDN API | Complex | 21,017 tok / 229ms | 45,601 tok / 439ms | 116,494 tok / 908ms | 1,230 links, Cheliped capped at 500 (maxLinks) |
| W3Schools | Complex | 12,530 tok / 131ms | 5,775 tok / 284ms | 20,414 tok / 170ms | Cheliped over-detects headings (59 vs 29 GT) |
| JSONPlaceholder | Minimal | 1,395 tok / 32ms | 1,360 tok / 63ms | 3,980 tok / 20ms | Near-identical with Playwright |
| HTTPBin | Minimal | 213 tok / 5ms | 175 tok / 113ms | 833 tok / 35ms | Swagger UI in iframe — all tools miss buttons/inputs |

#### Element Detection Accuracy (Cheliped vs Ground Truth)

| Site | Links | Buttons | Inputs | Headings | Verdict |
|:-----|------:|--------:|-------:|---------:|:--------|
| NPM Search | 105/2 | 2/0 | 2/0 | 6/2 | Over-detect (post-render vs pre-render GT) |
| Reddit | 202/1 | 50/0 | 29/0 | 2/0 | Over-detect (same reason) |
| YouTube | 16/6 | 15/6 | **1/1** | 2/0 | Good input detection, some over-detect |
| Twitter/X | 0/0 | **1/1** | 1/0 | 0/0 | Minimal content (auth wall) |
| Google | **11/11** | 11/7 | 7/1 | 0/0 | Perfect link recall, hidden inputs exposed |
| Stack Overflow | 28/2 | 13/0 | 9/0 | 4/2 | Over-detect (login page elements) |
| MDN API | 500/1230 | **9/8** | 0/0 | 35/52 | Link cap at 500, heading under-detect |
| W3Schools | 369/241 | 27/10 | **25/16** | 59/29 | Input recall good, heading over-detect |
| JSONPlaceholder | 25/29 | **1/1** | 0/0 | **8/8** | Accurate |
| HTTPBin | 5/15 | 0/11 | 0/1 | 2/13 | iframe blind spot (Swagger UI) |

#### Key Findings

1. **iframe/Shadow DOM is a real blind spot** — HTTPBin's Swagger UI content is invisible to all tools. Cheliped: 0/11 buttons, 0/1 inputs. Playwright also: 0/11, 0/0.
2. **Post-render extraction is a double-edged sword** — Cheliped's CDP approach renders JS fully (NPM: 105 links vs GT's 2), which is more accurate but inflates tokens.
3. **maxLinks cap matters on large pages** — MDN API has 1,230 links; Cheliped's cap returns 500. Configurable via options.
4. **Heavy SPAs are equally hard for everyone** — YouTube/Twitter extraction is slow (1–12s) and content-limited for all tools.
5. **Form detection advantage holds** — Even on edge cases, Cheliped finds more real inputs (Google: 7, W3Schools: 25) than competitors.

<details>
<summary>🔧 Run the benchmarks yourself</summary>

```bash
cd scripts
npm install
npm run build
node benchmark-compare.mjs      # Token efficiency & speed (6 sites)
node benchmark-quality.mjs      # Content recognition quality (6 sites)
node benchmark-limitations.mjs  # Edge cases & limitations (10 sites)
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
