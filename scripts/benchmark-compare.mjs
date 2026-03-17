#!/usr/bin/env node
// benchmark-compare.mjs — Compare Cheliped vs agent-browser vs Playwright MCP
// Measures: token output size, speed, on same target sites

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

function formatMs(ms) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatNumber(n) {
  return n.toLocaleString();
}

const TARGETS = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Web_browser' },
  { name: 'GitHub', url: 'https://github.com/trending' },
  { name: 'Example.com', url: 'https://example.com' },
];

// ─── Cheliped ───────────────────────────────────────────────────

async function benchCheliped(targets) {
  console.log('  🦀 Cheliped Browser...');
  const results = [];

  let Cheliped;
  try {
    const mod = await import('cheliped-browser');
    Cheliped = mod.Cheliped;
  } catch {
    const distPath = resolve(__dirname, 'dist/index.js');
    const mod = await import(distPath);
    Cheliped = mod.Cheliped;
  }

  const cheliped = new Cheliped({
    headless: true,
    compression: { enabled: true, maxTextLength: 120, maxLinks: 50 },
  });

  const launchStart = performance.now();
  await cheliped.launch();
  const launchTime = performance.now() - launchStart;

  for (const target of targets) {
    const r = { name: target.name, tool: 'Cheliped' };
    try {
      const navStart = performance.now();
      await cheliped.goto(target.url);
      r.navTime = performance.now() - navStart;

      const obsStart = performance.now();
      const dom = await cheliped.observe();
      r.observeTime = performance.now() - obsStart;

      const domStr = JSON.stringify(dom);
      r.outputTokens = estimateTokens(domStr);
      r.outputChars = domStr.length;

      // element count
      r.elementCount = (dom.buttons?.length ?? 0)
        + (dom.links?.length ?? 0)
        + (dom.inputs?.length ?? 0)
        + (dom.selects?.length ?? 0)
        + (dom.textareas?.length ?? 0)
        + (dom.images?.length ?? 0);

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message;
    }
    results.push(r);
  }

  await cheliped.close();
  return { results, launchTime };
}

// ─── agent-browser (Vercel) ─────────────────────────────────────

function benchAgentBrowser(targets) {
  console.log('  🔷 agent-browser (Vercel)...');
  const results = [];

  // agent-browser uses CLI: agent-browser open <url>, agent-browser snapshot
  // It auto-launches Chrome on first use

  let launchTime = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const r = { name: target.name, tool: 'agent-browser' };

    try {
      // Navigate
      const navStart = performance.now();
      execSync(`agent-browser open "${target.url}"`, {
        timeout: 30000,
        stdio: 'pipe',
      });
      r.navTime = performance.now() - navStart;
      if (i === 0) launchTime = r.navTime; // first includes launch

      // Snapshot (equivalent to observe)
      const obsStart = performance.now();
      const snapshot = execSync('agent-browser snapshot', {
        timeout: 15000,
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      r.observeTime = performance.now() - obsStart;

      r.outputChars = snapshot.length;
      r.outputTokens = estimateTokens(snapshot);

      // Count elements (lines with @ref pattern)
      const refMatches = snapshot.match(/@e\d+/g);
      r.elementCount = refMatches ? new Set(refMatches).size : 0;

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 100);
    }
    results.push(r);
  }

  // Close
  try {
    execSync('agent-browser close', { timeout: 5000, stdio: 'pipe' });
  } catch {}

  return { results, launchTime };
}

// ─── Playwright MCP (accessibility snapshot) ────────────────────

async function benchPlaywrightMCP(targets) {
  console.log('  🎭 Playwright MCP...');
  const results = [];

  // Playwright MCP exposes tools via MCP protocol. For benchmarking,
  // we use playwright directly to get accessibility snapshots.
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    console.log('    ⚠️  Playwright not installed, installing...');
    execSync('npm install playwright 2>/dev/null', { cwd: __dirname, stdio: 'pipe' });
    playwright = await import('playwright');
  }

  const launchStart = performance.now();
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const launchTime = performance.now() - launchStart;

  for (const target of targets) {
    const r = { name: target.name, tool: 'Playwright' };

    try {
      const navStart = performance.now();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      r.navTime = performance.now() - navStart;

      // Aria snapshot (what Playwright MCP uses)
      const obsStart = performance.now();
      const snapshot = await page.locator('body').ariaSnapshot();
      r.observeTime = performance.now() - obsStart;

      r.outputChars = snapshot.length;
      r.outputTokens = estimateTokens(snapshot);

      // Count elements (lines with role patterns like "- link", "- button", "- heading")
      const roleLines = snapshot.match(/^- \w+/gm);
      r.elementCount = roleLines ? roleLines.length : 0;

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 100);
    }
    results.push(r);
  }

  await browser.close();
  return { results, launchTime };
}

function countA11yNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (const child of node.children) {
      count += countA11yNodes(child);
    }
  }
  return count;
}

// ─── Puppeteer (accessibility snapshot) ──────────────────────────

async function benchPuppeteer(targets) {
  console.log('  🤖 Puppeteer...');
  const results = [];

  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.log('    ⚠️  Puppeteer not installed, skipping.');
    return { results: [], launchTime: 0 };
  }

  const launchStart = performance.now();
  const browser = await puppeteer.default.launch({ headless: 'new' });
  const page = await browser.newPage();
  const launchTime = performance.now() - launchStart;

  for (const target of targets) {
    const r = { name: target.name, tool: 'Puppeteer' };

    try {
      const navStart = performance.now();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      r.navTime = performance.now() - navStart;

      // Accessibility snapshot
      const obsStart = performance.now();
      const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
      r.observeTime = performance.now() - obsStart;

      const snapshotStr = JSON.stringify(snapshot);
      r.outputChars = snapshotStr.length;
      r.outputTokens = estimateTokens(snapshotStr);
      r.elementCount = countA11yNodes(snapshot);

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 100);
    }
    results.push(r);
  }

  await browser.close();
  return { results, launchTime };
}

// ─── Raw HTML baseline ──────────────────────────────────────────

async function getHtmlBaseline(targets) {
  console.log('  📄 Raw HTML baseline...');
  const results = [];

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return [];
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const target of targets) {
    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const html = await page.content();
      results.push({
        name: target.name,
        htmlTokens: estimateTokens(html),
        htmlChars: html.length,
      });
    } catch {
      results.push({ name: target.name, htmlTokens: 0, htmlChars: 0 });
    }
  }

  await browser.close();
  return results;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('🦀 Cheliped Browser — Competitive Benchmark');
  console.log('═'.repeat(72));
  console.log('');
  console.log('Tools: Cheliped vs agent-browser vs Playwright vs Puppeteer');
  console.log(`Sites: ${TARGETS.map(t => t.name).join(', ')}`);
  console.log('');
  console.log('Running benchmarks...');
  console.log('');

  // Get raw HTML baseline
  const htmlBaseline = await getHtmlBaseline(TARGETS);

  // Run each tool
  const cheliped = await benchCheliped(TARGETS);
  const agentBr = benchAgentBrowser(TARGETS);

  let playwrightRes;
  try {
    playwrightRes = await benchPlaywrightMCP(TARGETS);
  } catch (e) {
    console.log(`  ⚠️  Playwright benchmark failed: ${e.message}`);
    playwrightRes = { results: [], launchTime: 0 };
  }

  let puppeteerRes;
  try {
    puppeteerRes = await benchPuppeteer(TARGETS);
  } catch (e) {
    console.log(`  ⚠️  Puppeteer benchmark failed: ${e.message}`);
    puppeteerRes = { results: [], launchTime: 0 };
  }

  // ─── Output ───

  console.log('');
  console.log('');
  console.log('═'.repeat(72));
  console.log('📊 COMPARATIVE RESULTS');
  console.log('═'.repeat(72));

  // Helper to find results
  const find = (arr, name) => arr.find(r => r.name === name);

  // Table 1: Token Efficiency
  console.log('');
  console.log('## Token Efficiency (output tokens for LLM consumption)');
  console.log('');
  console.log('| Site | Raw HTML | Cheliped | agent-browser | Playwright | Puppeteer |');
  console.log('|------|---------|----------|---------------|------------|-----------|');

  for (let i = 0; i < TARGETS.length; i++) {
    const name = TARGETS[i].name;
    const html = htmlBaseline.find(h => h.name === name);
    const ch = find(cheliped.results, name);
    const ab = find(agentBr.results, name);
    const pw = find(playwrightRes.results, name);
    const pp = find(puppeteerRes.results, name);

    const tok = r => r?.success ? formatNumber(r.outputTokens) : '❌';

    console.log(`| ${name} | ${html ? formatNumber(html.htmlTokens) : '—'} | ${tok(ch)} | ${tok(ab)} | ${tok(pw)} | ${tok(pp)} |`);
  }

  // Table 2: Compression ratio vs raw HTML
  console.log('');
  console.log('## Compression Ratio (% token reduction vs Raw HTML)');
  console.log('');
  console.log('| Site | Cheliped | agent-browser | Playwright | Puppeteer |');
  console.log('|------|----------|---------------|------------|-----------|');

  for (let i = 0; i < TARGETS.length; i++) {
    const name = TARGETS[i].name;
    const html = htmlBaseline.find(h => h.name === name);
    const ch = find(cheliped.results, name);
    const ab = find(agentBr.results, name);
    const pw = find(playwrightRes.results, name);
    const pp = find(puppeteerRes.results, name);

    const ratio = (tool, baseline) => {
      if (!tool?.success || !baseline?.htmlTokens) return '—';
      return ((1 - tool.outputTokens / baseline.htmlTokens) * 100).toFixed(1) + '%';
    };

    console.log(`| ${name} | ${ratio(ch, html)} | ${ratio(ab, html)} | ${ratio(pw, html)} | ${ratio(pp, html)} |`);
  }

  // Table 3: Speed — Observe/Snapshot
  console.log('');
  console.log('## Speed — DOM Extraction');
  console.log('');
  console.log('| Site | Cheliped | agent-browser | Playwright | Puppeteer |');
  console.log('|------|----------|---------------|------------|-----------|');

  for (let i = 0; i < TARGETS.length; i++) {
    const name = TARGETS[i].name;
    const ch = find(cheliped.results, name);
    const ab = find(agentBr.results, name);
    const pw = find(playwrightRes.results, name);
    const pp = find(puppeteerRes.results, name);

    const ms = r => r?.success ? formatMs(r.observeTime) : '❌';

    console.log(`| ${name} | ${ms(ch)} | ${ms(ab)} | ${ms(pw)} | ${ms(pp)} |`);
  }

  // Table 4: Elements detected
  console.log('');
  console.log('## Interactive Elements Detected');
  console.log('');
  console.log('| Site | Cheliped | agent-browser | Playwright | Puppeteer |');
  console.log('|------|----------|---------------|------------|-----------|');

  for (let i = 0; i < TARGETS.length; i++) {
    const name = TARGETS[i].name;
    const ch = find(cheliped.results, name);
    const ab = find(agentBr.results, name);
    const pw = find(playwrightRes.results, name);
    const pp = find(puppeteerRes.results, name);

    const n = r => r?.success ? r.elementCount : '❌';

    console.log(`| ${name} | ${n(ch)} | ${n(ab)} | ${n(pw)} | ${n(pp)} |`);
  }

  // Summary
  console.log('');
  console.log('═'.repeat(72));
  console.log('📈 SUMMARY');
  console.log('═'.repeat(72));
  console.log('');

  const avg = (arr, key) => {
    const valid = arr.filter(r => r.success && r[key] != null);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + r[key], 0) / valid.length;
  };

  const tools = [
    { name: 'Cheliped', results: cheliped.results, launchTime: cheliped.launchTime, dep: 'ws (direct CDP, no Playwright/Puppeteer)' },
    { name: 'agent-browser', results: agentBr.results, launchTime: agentBr.launchTime, dep: 'Rust binary (direct CDP)' },
    { name: 'Playwright', results: playwrightRes.results, launchTime: playwrightRes.launchTime, dep: 'playwright (full browser framework)' },
    { name: 'Puppeteer', results: puppeteerRes.results, launchTime: puppeteerRes.launchTime, dep: 'puppeteer (Google browser framework)' },
  ];

  console.log('  Avg Output Tokens:');
  for (const t of tools) {
    const v = avg(t.results, 'outputTokens');
    if (v) console.log(`    ${t.name.padEnd(15)} ${formatNumber(Math.round(v))} tok`);
  }

  console.log('');
  console.log('  Avg Observe/Snapshot Time:');
  for (const t of tools) {
    const v = avg(t.results, 'observeTime');
    if (v) console.log(`    ${t.name.padEnd(15)} ${formatMs(v)}`);
  }

  console.log('');
  console.log('  Launch Time:');
  for (const t of tools) {
    if (t.launchTime) console.log(`    ${t.name.padEnd(15)} ${formatMs(t.launchTime)}`);
  }

  console.log('');
  console.log('  Dependencies:');
  for (const t of tools) {
    console.log(`    ${t.name.padEnd(15)} ${t.dep}`);
  }

  console.log('');
  console.log('Done. 🦀');
}

main().catch(err => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
