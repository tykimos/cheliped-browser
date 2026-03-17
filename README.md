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

## 🤖 Why Claude Code & OpenClaw?

Cheliped is not a general-purpose browser automation library. It is a **skill** — purpose-built for AI agent platforms that need to browse the web as part of larger tasks. Here's why the design fits Claude Code and OpenClaw specifically:

### The Problem: LLMs Can't See Web Pages

When an AI agent needs to "check a website" or "fill out a form", it faces a fundamental challenge: web pages are visual, but LLMs process text. Existing solutions have trade-offs:

| Approach | Problem for AI Agents |
|:---------|:---------------------|
| **Raw HTML** | 30,000–130,000 tokens per page. Blows up context windows, costs spike, reasoning quality drops. |
| **Screenshots** | Vision models can read them, but can't interact. "Click the blue button" requires knowing coordinates. |
| **Playwright / Puppeteer** | Designed for human developers writing test scripts — not for LLMs making autonomous decisions. Requires CSS selectors the LLM must construct. |
| **Accessibility trees** | Flat, verbose, no interaction IDs. The LLM must parse tree structure to understand the page. |

### The Solution: Agent DOM

Cheliped solves this with **Agent DOM** — a representation designed specifically for how LLMs reason:

```json
{
  "buttons": [{"id": 3, "text": "Submit"}, {"id": 4, "text": "Cancel"}],
  "inputs":  [{"id": 5, "placeholder": "Email", "type": "email"}],
  "links":   [{"id": 6, "text": "Forgot password?", "href": "/reset"}],
  "texts":   ["Welcome back! Please sign in to continue."]
}
```

The LLM instantly knows: there are 2 buttons, 1 input field, 1 link, and context text. To fill the email field, it says `fill 5 "user@example.com"`. To submit, it says `click 3`. No CSS selectors, no XPath, no coordinate calculation.

### How It Integrates with Claude Code

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) discovers skills automatically via `SKILL.md`. When a user asks Claude to "check a website" or "fill out a form", Claude Code:

1. **Detects the trigger** — SKILL.md's description matches browsing-related intents
2. **Reads the skill** — learns the `observe → act → observe` workflow and available commands
3. **Executes via CLI** — runs `node scripts/cheliped-cli.mjs '[...]'` with JSON commands
4. **Parses JSON output** — Agent DOM comes back as structured JSON to stdout, directly consumable

```
User: "Check the top 3 stories on Hacker News"
    │
    ▼
Claude Code: detects browsing intent → loads cheliped-browser skill
    │
    ▼
Shell: node cheliped-cli.mjs '[{"cmd":"goto","args":["https://news.ycombinator.com"]},{"cmd":"observe"}]'
    │
    ▼
Agent DOM (JSON): {"links": [{"id":1, "text":"Story 1", "href":"..."}, ...], "texts": [...]}
    │
    ▼
Claude Code: parses Agent DOM → responds "The top 3 stories are: 1. ... 2. ... 3. ..."
```

Key design choices for Claude Code compatibility:
- **All output is JSON to stdout** — no interactive prompts, no TUI, no color codes. Pure machine-readable output.
- **Stateless CLI calls** — each invocation is a standalone command. Claude Code doesn't maintain process state between tool calls.
- **Session persistence via Chrome** — Chrome stays alive between CLI calls. Claude Code can `goto` in one turn, `observe` in the next, `click` in the third — all on the same browser session.
- **Error format** — failures return `{"error": "message"}` so Claude can reason about what went wrong.

### How It Integrates with OpenClaw

[OpenClaw](https://openclaw.org) uses the same skill discovery pattern. When installed at `~/.openclaw/skills/cheliped-browser/`, OpenClaw agents can:

1. **Auto-discover** — OpenClaw scans the skills directory and reads SKILL.md metadata
2. **Invoke the browser tool** — agents call cheliped commands through the `browser` tool interface
3. **Multi-agent browsing** — `--session` flag lets different OpenClaw agents browse independently with isolated Chrome instances

```
OpenClaw Agent: "어시, 해커뉴스 톱 3 뉴스 알려줘"
    │
    ▼
OpenClaw: skill match → cheliped-browser → browser tool
    │
    ▼
Cheliped: goto → observe → Agent DOM
    │
    ▼
Agent: "현재 Hacker News 톱 3 뉴스: 1. ... 2. ... 3. ..."
```

### Why Not Just Use Playwright/Puppeteer Directly?

AI agent platforms *could* give LLMs direct access to Playwright or Puppeteer. But:

| | Cheliped (Skill) | Playwright/Puppeteer (Direct) |
|:--|:-----------------|:-----------------------------|
| **LLM must know** | 10 simple commands (`goto`, `observe`, `click`, `fill`, ...) | Hundreds of API methods, CSS selector syntax, async patterns |
| **Interaction** | `click 3` (numeric ID) | `page.click('button.submit-form:nth-child(2)')` (fragile selector) |
| **Token cost** | ~2,864 tokens avg | ~5,000–12,000 tokens avg |
| **Context needed** | SKILL.md (~80 lines) | Full API docs (thousands of lines) |
| **Error recovery** | Simple JSON errors | Stack traces, timeout errors, selector not found |
| **Install** | `npm install` (ws only) | Full browser framework + browser binary |

Cheliped abstracts away browser complexity so the LLM can focus on **what to do**, not **how to do it**.

### Design Principles

1. **Token-first** — Every design decision optimizes for fewer tokens. LLM API costs scale with token count; fewer tokens = cheaper and faster agent runs.
2. **Observe-Act loop** — Matches reinforcement learning patterns that LLMs handle naturally. Observe state → reason → act → observe new state.
3. **Numeric IDs over selectors** — LLMs are better at referencing `id: 3` than constructing `div.container > form > button:first-child`. Selectors break on DOM changes; numeric IDs are always valid after the latest `observe`.
4. **JSON in, JSON out** — No parsing ambiguity. The LLM sends JSON commands and receives JSON results. No regex needed, no text scraping.
5. **Zero-config for agents** — First call auto-launches Chrome. No setup step needed in the agent's workflow. Just `goto` and go.

---

## ⚖️ How Does It Compare?

> Benchmarked on 16 sites (static, SPA, forms, complex, edge cases) · 2025-03-18 · v1.0.0

| | Cheliped | agent-browser | Playwright | Puppeteer |
|:--|:---------|:--------------|:-----------|:----------|
| **Best for** | LLM agent browsing | CLI automation | Full browser testing | Headless scripting |
| **Avg Tokens** | **2,864** | 11,882 | 5,704 | 5,051 |
| **Avg Speed** | **51ms** | 205ms | 78ms | 81ms |
| **Quality** | **86.4%** | 72.8% | 75.4% | 73.4% |
| **Dependencies** | ws only | Rust binary | Full framework | Full framework |
| **iframe/Shadow DOM** | Same-origin only | No | Partial | Partial |
| **SPA Support** | Basic | Basic | Excellent | Good |
| **Wait Strategy** | Network idle | Manual | Auto-wait | Manual |
| **Production Maturity** | Early | Stable | Mature | Mature |

### Performance at a Glance

![Benchmark Summary](docs/images/benchmark-summary.png)

![Quality Breakdown](docs/images/benchmark-quality-breakdown.png)

### Strengths

- **2–4x fewer tokens** than all competitors — directly reduces LLM API costs
- **Fastest extraction (51ms avg)** — 1.5–4x faster than alternatives via direct CDP
- **Best content recognition (86.4%)** — highest recall on links, buttons, inputs, headings
- **Agent DOM** — purpose-built for LLM agents: numbered interactive elements with semantic grouping
- **Zero framework dependencies** — just `ws` for WebSocket, no Playwright/Puppeteer required
- **Same-origin iframe extraction** — merges iframe content into main Agent DOM (CDP-based)
- **Smart link deduplication** — keeps best text per URL, reduces noise on link-heavy pages
- **React/SPA fill** — native input value setters bypass synthetic event systems
- **Session persistence** — Chrome stays alive between agent invocations, no restart overhead
- **Concurrent sessions** — multiple agents browse independently with `--session`

### Known Limitations

Tested on 10 edge-case sites (NPM, Reddit, YouTube, Twitter/X, Google, Stack Overflow, MDN API, W3Schools, JSONPlaceholder, HTTPBin):

- **Cross-origin iframe / Shadow DOM blind spot** — HTTPBin (Swagger UI in cross-origin iframe): buttons 0/11, inputs 0/1, headings 2/13. Same-origin iframes are now extracted, but cross-origin and shadow roots remain invisible. Playwright has the same limitation via ariaSnapshot.
- **Link cap on large pages** — `maxLinks: 5000` but link dedup caps at first occurrence per href. MDN API: 500/1,230 unique links. Configurable but adds tokens.
- **Over-detection on JS-heavy pages** — NPM search: GT reports 2 links (pre-render) but Cheliped finds 105 (post-render). This is actually more accurate, but inflates token count (3,865 tok vs Playwright's 2 tok).
- **Heavy SPA navigation is slow** — Twitter/X, YouTube: all tools are slow on auth-walled SPAs.
- **Heading under-detect on complex pages** — MDN API: 27/52 headings detected (52%). Heading dedup removes duplicates but some unique headings in deeply nested structures are missed.
- **Small SPA token overhead** — TodoMVC (655 tok raw): Cheliped 521 tok vs Puppeteer 388 tok. Structured JSON overhead is minimal on tiny pages.
- **Early-stage project** — not yet battle-tested in production. Playwright and Puppeteer have years of maturity.
- **Benchmark caveats**: token estimation uses `chars/4` (not tiktoken); Playwright/Puppeteer benchmarked via a11y snapshots, not their primary CSS selector APIs.

---

## 🚀 Getting Started

### As a Claude Code Skill

Claude Code discovers skills from `~/.claude/skills/`. Once installed, Claude automatically uses Cheliped whenever it detects browsing-related tasks ("check this website", "fill out this form", "scrape this page").

```bash
git clone https://github.com/tykimos/cheliped-browser.git ~/.claude/skills/cheliped-browser
cd ~/.claude/skills/cheliped-browser/scripts && npm install && npm run build
```

No configuration needed. Claude Code reads `SKILL.md`, learns the commands, and starts using them autonomously.

### As an OpenClaw Skill

OpenClaw discovers skills from `~/.openclaw/skills/`. The agent can invoke Cheliped through OpenClaw's `browser` tool interface, with the same observe-act workflow.

```bash
git clone https://github.com/tykimos/cheliped-browser.git ~/.openclaw/skills/cheliped-browser
cd ~/.openclaw/skills/cheliped-browser/scripts && npm install && npm run build

# Also symlink to workspace for full compatibility
ln -s ~/.openclaw/skills/cheliped-browser ~/.openclaw/workspace/skills/cheliped-browser
```

### Standalone (No AI Agent)

Cheliped can also be used directly from the command line for scripting or testing:

```bash
git clone https://github.com/tykimos/cheliped-browser.git && cd cheliped-browser
cd scripts && npm install && npm run build
node cheliped-cli.mjs '[{"cmd":"goto","args":["https://example.com"]},{"cmd":"observe"}]'
```

---

## 🧩 How It Works

### The Key Difference: Agent DOM vs Raw Snapshots

Most browser tools give LLMs raw accessibility trees or HTML snapshots. Cheliped takes a fundamentally different approach:

| Approach | Cheliped | Playwright / Puppeteer | agent-browser |
|:---------|:---------|:----------------------|:--------------|
| **Output format** | Structured JSON with categorized arrays (`buttons`, `links`, `inputs`, `texts`, `headings`) | Flat accessibility tree or ARIA snapshot (text/YAML) | Raw text extraction |
| **Element IDs** | Every interactive element gets a numeric `agentId` for direct interaction | CSS selectors or XPath (agent must construct) | No direct interaction |
| **Protocol** | Direct CDP WebSocket — no framework overhead | Full browser framework (Playwright/Puppeteer) | Rust binary with CDP |
| **Pipeline** | DOM → Filter (visible only) → Semantic grouping → Compression → Dedup | Single-pass a11y tree dump | Single-pass text extraction |
| **Token efficiency** | ~2,864 avg tokens (semantic compression) | ~5,000–5,700 tokens (full tree) | ~11,882 tokens (verbose text) |

**Why this matters for LLM agents:** An LLM receiving `{"buttons": [{"id": 3, "text": "Submit"}]}` can immediately reason about what to click. With a flat a11y tree like `button "Submit"`, the agent must parse the tree structure, find the element, and figure out how to reference it for interaction.

### The Observe-Act Loop

```
  goto         observe        act          observe
   │              │            │              │
   ▼              ▼            ▼              ▼
┌──────┐    ┌──────────┐   ┌──────┐    ┌──────────┐
│ Load │───▶│ Agent DOM│──▶│click │───▶│ Agent DOM│──▶ ...
│ page │    │ + IDs    │   │fill  │    │ (updated)│
└──────┘    └──────────┘   └──────┘    └──────────┘
```

1. **`goto`** a URL → page loads, waits for network idle
2. **`observe`** → 4-stage pipeline produces Agent DOM with `agentId` per interactive element
3. **`click`** / **`fill`** using the `agentId` (CDP-native, no selector fragility)
4. **`observe`** again → see the updated state
5. Repeat until done

### How Cheliped Handles What Others Can't

- **Input fields**: Cheliped uses native `HTMLInputElement.value` setters via CDP `Runtime.callFunctionOn`, bypassing React/Vue synthetic event systems. Playwright/Puppeteer type character-by-character, which can conflict with SPA input handlers.
- **Click reliability**: Primary click via CDP `Input.dispatchMouseEvent`, with fallback via `DOM.resolveNode` + `Runtime.callFunctionOn` for elements in complex layouts. No CSS selector construction needed.
- **Same-origin iframes**: Extracts content via `Page.getFrameTree` → `Page.createIsolatedWorld` → `Runtime.evaluate`, merging child frame elements into the main Agent DOM. Other tools require separate frame handling.
- **Link deduplication**: Two-pass algorithm — first finds the best (longest) text for each unique URL, then keeps only the first positional occurrence. Reduces noise on navigation-heavy pages.
- **Heading preservation**: `h1`–`h6` tag identity is preserved through the full pipeline (`tag` field), with deduplication to remove exact-text duplicates.

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

> **Date**: 2025-03-18 · **Versions**: Cheliped 1.0.0, agent-browser 0.20.14, Playwright 1.58.2, Puppeteer 22.15.0
> **Sites**: Hacker News, Wikipedia, GitHub Trending, Example.com, React TodoMVC (SPA), MDN Web Docs · **Environment**: macOS, Node.js 24, Chrome

### Token Efficiency

| Site | Raw HTML | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|---------:|--------------:|-----------:|----------:|
| Hacker News | 8,702 | **2,497** | 15,300 | 10,014 | 4,795 |
| Wikipedia | 71,138 | **7,281** | 39,475 | 15,417 | 19,744 |
| GitHub | 130,500 | 3,863 | 4,180 | 2,347 | **1,592** |
| Example.com | 132 | 111 | 120 | **58** | 71 |
| React (SPA) | 655 | 521 | 1,016 | 488 | **388** |
| MDN Web Docs | 24,929 | **2,912** | 11,203 | 5,901 | 3,717 |
| **Average** | **39,343** | **2,864** | **11,882** | **5,704** | **5,051** |

![Tokens per Site](docs/images/benchmark-tokens-per-site.png)

### Speed — DOM Extraction

| Site | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|--------:|--------------:|-----------:|----------:|
| Hacker News | **46ms** | 209ms | 82ms | 72ms |
| Wikipedia | **83ms** | 270ms | 86ms | 167ms |
| GitHub | 113ms | 188ms | 124ms | **112ms** |
| Example.com | **7ms** | 174ms | 23ms | 33ms |
| React (SPA) | **6ms** | 175ms | 28ms | 24ms |
| MDN Web Docs | **52ms** | 214ms | 127ms | 77ms |
| **Average** | **51ms** | **205ms** | **78ms** | **81ms** |

![Speed per Site](docs/images/benchmark-speed-per-site.png)

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
| Hacker News | 90.5% | 90.5% | 90.5% | 90.5% |
| Wikipedia | 76.0% | **95.0%** | 90.0% | 90.0% |
| GitHub | **37.0%** | 12.0% | 12.0% | 8.5% |
| Example.com | **100.0%** | **100.0%** | **100.0%** | **100.0%** |
| React (SPA) | 91.3% | **100.0%** | **100.0%** | **100.0%** |
| MDN Web Docs | **90.0%** | 68.5% | 68.5% | 68.0% |
| **Average** | **80.8%** | 77.7% | 76.8% | 76.2% |

> Cheliped leads overall but loses on Wikipedia (compression truncates) and GitHub (list item limit).
> All tools struggle with GitHub — dynamic rendering hides content from all extraction methods.

#### Link Detection

| Site | | Cheliped | agent-browser | Playwright | Puppeteer |
|:-----|:--|--------:|--------------:|-----------:|----------:|
| Hacker News | Recall | **100%** | **100%** | 98% | **100%** |
| | Precision | **100%** | **100%** | 86% | 87% |
| Wikipedia | Recall | 84% | 84% | 84% | 84% |
| | Precision | 84% | **95%** | **95%** | **95%** |
| GitHub | Recall | **100%** | 82% | 82% | 76% |
| | Precision | 34% | **48%** | **48%** | 45% |
| Example.com | Recall | **100%** | **100%** | **100%** | **100%** |
| | Precision | **100%** | **100%** | **100%** | **100%** |
| React (SPA) | Recall | **100%** | **100%** | **100%** | **100%** |
| | Precision | **100%** | **100%** | **100%** | **100%** |
| MDN Web Docs | Recall | **100%** | 46% | 46% | 46% |
| | Precision | **96%** | **100%** | **100%** | **100%** |
| **Average** | **Recall** | **97.3%** | 85.4% | 85.0% | 84.2% |
| | **Precision** | 85.6% | **90.5%** | 88.2% | 87.8% |

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
| Wikipedia | 14 | **1** (7%) | 1 (7%) | 0 (0%) | 0 (0%) |
| React (SPA) | 1 | **1** (100%) | 0 (0%) | 0 (0%) | **1** (100%) |
| **Average** | | **67.9%** | 1.2% | 33.3% | 50.0% |

> Cheliped detects the most real input fields overall. Other tools' a11y/snapshot formats lose most input fields.
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
| Text Recall | 25% | **80.8%** | 77.7% | 76.8% | 76.2% |
| Link Recall | 20% | **97.3%** | 85.4% | 85.0% | 84.2% |
| Link Precision | 10% | 85.6% | **90.5%** | 88.2% | 87.8% |
| Button Recall | 15% | **97.9%** | 92.3% | 82.4% | 55.1% |
| Input Recall | 15% | **67.9%** | 1.2% | 33.3% | 50.0% |
| Heading Recall | 15% | **89.1%** | 88.1% | 86.4% | 86.7% |
| **Overall** | **100%** | **86.4%** | **72.8%** | **75.4%** | **73.4%** |

### Edge Case & Limitation Test

> Tested on 10 additional sites targeting known weaknesses: long lists, heavy SPAs, forms, complex structure, iframes.

#### Navigation & Extraction

| Site | Category | Cheliped | Playwright | Puppeteer | Notes |
|:-----|:---------|--------:|----------:|----------:|:------|
| NPM Search | Long List | 3,865 tok / 28ms | 2 tok / 43ms | 444 tok / 236ms | Cheliped extracts post-render content (105 links); others see pre-render |
| Reddit | Long List | 10,959 tok / 27ms | 65 tok / 40ms | 223 tok / 24ms | Similar: Cheliped renders fully, outputs more |
| YouTube | Heavy SPA | 520 tok / 557ms | 34 tok / 54ms | 1,685 tok / 14ms | All limited by consent/auth wall |
| Twitter/X | Heavy SPA | 190 tok / 19ms | 22 tok / 344ms | 67 tok / 53ms | Login wall — all tools see minimal content |
| Google Search | Forms | 609 tok / 27ms | 350 tok / 67ms | 898 tok / 20ms | Cheliped finds 7 inputs vs GT 1 (hidden inputs exposed) |
| Stack Overflow | Forms | 1,652 tok / 29ms | 2 tok / 32ms | 44 tok / 33ms | Login required — Cheliped extracts nav elements |
| MDN API | Complex | 20,959 tok / 133ms | 45,601 tok / 267ms | 116,494 tok / 488ms | 1,230 links, Cheliped dedup caps at ~500 |
| W3Schools | Complex | 11,480 tok / 67ms | 5,763 tok / 78ms | 20,414 tok / 156ms | Cheliped headings 36 vs 29 GT (slight over-detect) |
| JSONPlaceholder | Minimal | 1,422 tok / 7ms | 1,360 tok / 43ms | 3,980 tok / 15ms | Near-identical with Playwright |
| HTTPBin | Minimal | 213 tok / 3ms | 175 tok / 36ms | 833 tok / 14ms | Swagger UI in cross-origin iframe — all tools miss buttons/inputs |

#### Element Detection Accuracy (Cheliped vs Ground Truth)

| Site | Links | Buttons | Inputs | Headings | Verdict |
|:-----|------:|--------:|-------:|---------:|:--------|
| NPM Search | 105/2 | 2/0 | 2/0 | 6/2 | Over-detect (post-render vs pre-render GT) |
| Reddit | 208/1 | 56/0 | 29/0 | 2/0 | Over-detect (same reason) |
| YouTube | 14/6 | 13/6 | **1/1** | 1/0 | Good input detection, some over-detect |
| Twitter/X | 0/0 | **1/1** | 1/0 | 0/0 | Minimal content (auth wall) |
| Google | **11/11** | 11/7 | 7/1 | 0/0 | Perfect link recall, hidden inputs exposed |
| Stack Overflow | 28/2 | 13/0 | 9/0 | 4/2 | Over-detect (login page elements) |
| MDN API | 500/1230 | **9/8** | 0/0 | 27/52 | Link dedup caps at ~500, heading 52% |
| W3Schools | 317/241 | 27/10 | **25/16** | 36/29 | Input recall good, heading slight over-detect |
| JSONPlaceholder | 25/29 | **1/1** | 0/0 | **8/8** | Accurate |
| HTTPBin | 5/15 | 0/11 | 0/1 | 2/13 | Cross-origin iframe blind spot (Swagger UI) |

#### Key Findings

1. **Cross-origin iframe is a real blind spot** — HTTPBin's Swagger UI (cross-origin iframe) is invisible to all tools. Cheliped now extracts same-origin iframes, but cross-origin remains blocked by browser security.
2. **Post-render extraction is a double-edged sword** — Cheliped's CDP approach renders JS fully (NPM: 105 links vs GT's 2), which is more accurate but inflates tokens.
3. **Smart link dedup reduces noise** — MDN API has 1,230 links; Cheliped's two-pass dedup returns ~500 unique URLs with best text. Configurable via options.
4. **Heavy SPAs are equally hard for everyone** — YouTube/Twitter extraction is slow and content-limited for all tools.
5. **Form detection advantage holds** — Even on edge cases, Cheliped finds more real inputs (Google: 7, W3Schools: 25) than competitors.
6. **Heading dedup improves accuracy** — W3Schools headings reduced from over-detect to near-accurate (36 vs 29 GT). MDN improved from 4 to 27/52.

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
