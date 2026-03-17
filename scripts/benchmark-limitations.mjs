#!/usr/bin/env node
// benchmark-limitations.mjs — Test known limitations and edge cases
// Targets: Shadow DOM, iframes, heavy SPA, long lists, complex forms, dynamic content

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

// ─── Edge Case Test Sites ────────────────────────────────────────

const EDGE_CASES = [
  // List-heavy: known weakness
  { name: 'NPM (list)', url: 'https://www.npmjs.com/search?q=browser', category: 'Long List' },
  { name: 'Reddit', url: 'https://old.reddit.com/r/programming/', category: 'Long List' },

  // Heavy SPA / dynamic rendering
  { name: 'YouTube', url: 'https://www.youtube.com', category: 'Heavy SPA' },
  { name: 'Twitter/X', url: 'https://x.com/explore', category: 'Heavy SPA' },

  // Form-heavy
  { name: 'Google Search', url: 'https://www.google.com', category: 'Forms' },
  { name: 'Stack Overflow Ask', url: 'https://stackoverflow.com/questions/ask', category: 'Forms' },

  // Complex structure
  { name: 'MDN Reference', url: 'https://developer.mozilla.org/en-US/docs/Web/API', category: 'Complex Structure' },
  { name: 'W3Schools', url: 'https://www.w3schools.com/html/html_forms.asp', category: 'Complex Structure' },

  // Minimal / edge
  { name: 'JSON Placeholder', url: 'https://jsonplaceholder.typicode.com', category: 'Minimal' },
  { name: 'HTTPBin', url: 'https://httpbin.org', category: 'Minimal' },
];

// ─── Cheliped ────────────────────────────────────────────────────

async function testCheliped(targets) {
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
    compression: { enabled: true, maxTextLength: 300, maxLinks: 500 },
  });
  await cheliped.launch();

  const results = [];

  for (const target of targets) {
    const r = { name: target.name, category: target.category, tool: 'Cheliped' };
    try {
      const navStart = performance.now();
      await cheliped.goto(target.url);
      r.navTime = Math.round(performance.now() - navStart);

      const obsStart = performance.now();
      const dom = await cheliped.observe();
      r.observeTime = Math.round(performance.now() - obsStart);

      const domStr = JSON.stringify(dom);
      r.tokens = estimateTokens(domStr);
      r.links = (dom.links || []).length;
      r.buttons = (dom.buttons || []).length;
      r.inputs = (dom.inputs || []).length;
      r.texts = (dom.texts || []).length;
      r.headings = (dom.texts || []).filter(t => /^h[1-6]$/.test(t.tag)).length;
      r.images = (dom.images || []).length;
      r.selects = (dom.selects || []).length;
      r.textareas = (dom.textareas || []).length;
      r.totalElements = r.links + r.buttons + r.inputs + r.texts + r.headings + r.images + r.selects + r.textareas;
      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 120);
    }
    results.push(r);
  }

  await cheliped.close();
  return results;
}

// ─── Playwright ──────────────────────────────────────────────────

async function testPlaywright(targets) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return [];
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const target of targets) {
    const r = { name: target.name, category: target.category, tool: 'Playwright' };
    try {
      const navStart = performance.now();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      r.navTime = Math.round(performance.now() - navStart);

      const obsStart = performance.now();
      const snapshot = await page.locator('body').ariaSnapshot();
      r.observeTime = Math.round(performance.now() - obsStart);

      r.tokens = estimateTokens(snapshot);

      // Parse snapshot
      const lines = snapshot.split('\n');
      r.links = lines.filter(l => /^\s*- link\b/.test(l)).length;
      r.buttons = lines.filter(l => /^\s*- button\b/.test(l)).length;
      r.inputs = lines.filter(l => /^\s*- (textbox|searchbox|combobox|spinbutton)\b/.test(l)).length;
      r.headings = lines.filter(l => /^\s*- heading\b/.test(l)).length;
      r.texts = lines.filter(l => /^\s*- (paragraph|text|listitem)\b/.test(l)).length;
      r.images = lines.filter(l => /^\s*- img\b/.test(l)).length;
      r.selects = 0;
      r.textareas = lines.filter(l => /^\s*- textbox\b/.test(l) && /multi/i.test(l)).length;
      r.totalElements = r.links + r.buttons + r.inputs + r.headings + r.images;

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 120);
    }
    results.push(r);
  }

  await browser.close();
  return results;
}

// ─── Puppeteer ───────────────────────────────────────────────────

async function testPuppeteer(targets) {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch {
    return [];
  }

  const browser = await puppeteer.default.launch({ headless: 'new' });
  const page = await browser.newPage();
  const results = [];

  for (const target of targets) {
    const r = { name: target.name, category: target.category, tool: 'Puppeteer' };
    try {
      const navStart = performance.now();
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      r.navTime = Math.round(performance.now() - navStart);

      const obsStart = performance.now();
      const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
      r.observeTime = Math.round(performance.now() - obsStart);

      const snapshotStr = JSON.stringify(snapshot);
      r.tokens = estimateTokens(snapshotStr);

      // Walk tree
      let links = 0, buttons = 0, inputs = 0, headings = 0, texts = 0, images = 0;
      function walk(node) {
        if (!node) return;
        if (node.role === 'link') links++;
        if (node.role === 'button') buttons++;
        if (['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(node.role)) inputs++;
        if (node.role === 'heading') headings++;
        if (['StaticText', 'paragraph'].includes(node.role)) texts++;
        if (node.role === 'img') images++;
        if (node.children) node.children.forEach(walk);
      }
      walk(snapshot);

      r.links = links;
      r.buttons = buttons;
      r.inputs = inputs;
      r.headings = headings;
      r.texts = texts;
      r.images = images;
      r.selects = 0;
      r.textareas = 0;
      r.totalElements = links + buttons + inputs + headings + images;

      r.success = true;
    } catch (e) {
      r.success = false;
      r.error = e.message?.substring(0, 120);
    }
    results.push(r);
  }

  await browser.close();
  return results;
}

// ─── Ground Truth ────────────────────────────────────────────────

async function collectGroundTruth(targets) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    return [];
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const target of targets) {
    try {
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);

      const truth = await page.evaluate(() => {
        const count = (sel) => {
          let n = 0;
          document.querySelectorAll(sel).forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') n++;
          });
          return n;
        };

        // Visible text count
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => {
            const el = n.parentElement;
            if (!el) return NodeFilter.FILTER_REJECT;
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG'].includes(el.tagName)) return NodeFilter.FILTER_REJECT;
            return n.textContent.trim().length >= 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
          }
        });
        let textCount = 0;
        while (walker.nextNode()) textCount++;

        return {
          texts: textCount,
          links: count('a[href]'),
          buttons: count('button, [role="button"], input[type="submit"], input[type="button"]'),
          inputs: count('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'),
          headings: count('h1, h2, h3, h4, h5, h6'),
          images: count('img[src]'),
          iframes: document.querySelectorAll('iframe').length,
          shadowRoots: document.querySelectorAll('*').length, // approximate complexity
          title: document.title,
        };
      });

      results.push({ name: target.name, category: target.category, ...truth });
    } catch (e) {
      results.push({ name: target.name, category: target.category, error: e.message?.substring(0, 80) });
    }
  }

  await browser.close();
  return results;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('🦀 Cheliped Browser — Limitation & Edge Case Test');
  console.log('═'.repeat(72));
  console.log('');
  console.log('Testing known weaknesses: long lists, heavy SPAs, forms, complex structure');
  console.log(`Sites: ${EDGE_CASES.map(t => t.name).join(', ')}`);
  console.log('');

  // Collect data
  console.log('  📏 Ground truth...');
  const groundTruth = await collectGroundTruth(EDGE_CASES);

  console.log('  🦀 Cheliped...');
  const chelipedRes = await testCheliped(EDGE_CASES);

  console.log('  🎭 Playwright...');
  let playwrightRes = [];
  try {
    playwrightRes = await testPlaywright(EDGE_CASES);
  } catch (e) {
    console.log(`  ⚠️ Playwright failed: ${e.message?.substring(0, 80)}`);
  }

  console.log('  🤖 Puppeteer...');
  let puppeteerRes = [];
  try {
    puppeteerRes = await testPuppeteer(EDGE_CASES);
  } catch (e) {
    console.log(`  ⚠️ Puppeteer failed: ${e.message?.substring(0, 80)}`);
  }

  const tools = [
    { name: 'Cheliped', results: chelipedRes },
    { name: 'Playwright', results: playwrightRes },
    { name: 'Puppeteer', results: puppeteerRes },
  ];

  // ─── Output ────────────────────────────────────────────────────

  console.log('');
  console.log('═'.repeat(72));
  console.log('📊 EDGE CASE RESULTS');
  console.log('═'.repeat(72));

  // Ground truth
  console.log('');
  console.log('## Ground Truth');
  console.log('');
  console.log('| Site | Category | Texts | Links | Buttons | Inputs | Headings | Images |');
  console.log('|------|----------|------:|------:|--------:|-------:|---------:|-------:|');
  for (const gt of groundTruth) {
    if (gt.error) {
      console.log(`| ${gt.name} | ${gt.category} | ❌ ${gt.error.substring(0,30)} | | | | | |`);
    } else {
      console.log(`| ${gt.name} | ${gt.category} | ${gt.texts} | ${gt.links} | ${gt.buttons} | ${gt.inputs} | ${gt.headings} | ${gt.images} |`);
    }
  }

  // Success/Failure
  console.log('');
  console.log('## Navigation Success');
  console.log('');
  console.log('| Site | Category | Cheliped | Playwright | Puppeteer |');
  console.log('|------|----------|----------|------------|-----------|');
  for (const ec of EDGE_CASES) {
    const ch = chelipedRes.find(r => r.name === ec.name);
    const pw = playwrightRes.find(r => r.name === ec.name);
    const pp = puppeteerRes.find(r => r.name === ec.name);
    const status = r => {
      if (!r) return '—';
      return r.success ? `✅ ${r.navTime}ms` : `❌`;
    };
    console.log(`| ${ec.name} | ${ec.category} | ${status(ch)} | ${status(pw)} | ${status(pp)} |`);
  }

  // Token comparison
  console.log('');
  console.log('## Token Output');
  console.log('');
  console.log('| Site | Category | Cheliped | Playwright | Puppeteer |');
  console.log('|------|----------|--------:|----------:|----------:|');
  for (const ec of EDGE_CASES) {
    const ch = chelipedRes.find(r => r.name === ec.name);
    const pw = playwrightRes.find(r => r.name === ec.name);
    const pp = puppeteerRes.find(r => r.name === ec.name);
    const tok = r => r?.success ? r.tokens.toLocaleString() : '❌';
    console.log(`| ${ec.name} | ${ec.category} | ${tok(ch)} | ${tok(pw)} | ${tok(pp)} |`);
  }

  // Element detection comparison
  console.log('');
  console.log('## Element Detection (Cheliped vs Ground Truth)');
  console.log('');
  console.log('| Site | Category | GT Links | CH Links | GT Buttons | CH Buttons | GT Inputs | CH Inputs | GT Headings | CH Headings |');
  console.log('|------|----------|--------:|--------:|-----------:|-----------:|----------:|----------:|------------:|------------:|');
  for (const ec of EDGE_CASES) {
    const gt = groundTruth.find(g => g.name === ec.name);
    const ch = chelipedRes.find(r => r.name === ec.name);
    if (!gt || gt.error || !ch?.success) {
      console.log(`| ${ec.name} | ${ec.category} | — | — | — | — | — | — | — | — |`);
      continue;
    }
    console.log(`| ${ec.name} | ${ec.category} | ${gt.links} | ${ch.links} | ${gt.buttons} | ${ch.buttons} | ${gt.inputs} | ${ch.inputs} | ${gt.headings} | ${ch.headings} |`);
  }

  // Element detection - Playwright vs Ground Truth
  console.log('');
  console.log('## Element Detection (Playwright vs Ground Truth)');
  console.log('');
  console.log('| Site | Category | GT Links | PW Links | GT Buttons | PW Buttons | GT Inputs | PW Inputs | GT Headings | PW Headings |');
  console.log('|------|----------|--------:|--------:|-----------:|-----------:|----------:|----------:|------------:|------------:|');
  for (const ec of EDGE_CASES) {
    const gt = groundTruth.find(g => g.name === ec.name);
    const pw = playwrightRes.find(r => r.name === ec.name);
    if (!gt || gt.error || !pw?.success) {
      console.log(`| ${ec.name} | ${ec.category} | — | — | — | — | — | — | — | — |`);
      continue;
    }
    console.log(`| ${ec.name} | ${ec.category} | ${gt.links} | ${pw.links} | ${gt.buttons} | ${pw.buttons} | ${gt.inputs} | ${pw.inputs} | ${gt.headings} | ${pw.headings} |`);
  }

  // Speed comparison
  console.log('');
  console.log('## Extraction Speed');
  console.log('');
  console.log('| Site | Category | Cheliped | Playwright | Puppeteer |');
  console.log('|------|----------|--------:|----------:|----------:|');
  for (const ec of EDGE_CASES) {
    const ch = chelipedRes.find(r => r.name === ec.name);
    const pw = playwrightRes.find(r => r.name === ec.name);
    const pp = puppeteerRes.find(r => r.name === ec.name);
    const ms = r => r?.success ? `${r.observeTime}ms` : '❌';
    console.log(`| ${ec.name} | ${ec.category} | ${ms(ch)} | ${ms(pw)} | ${ms(pp)} |`);
  }

  // ─── Per-category analysis ─────────────────────────────────────

  console.log('');
  console.log('═'.repeat(72));
  console.log('📈 PER-CATEGORY ANALYSIS');
  console.log('═'.repeat(72));

  const categories = [...new Set(EDGE_CASES.map(e => e.category))];
  for (const cat of categories) {
    console.log('');
    console.log(`### ${cat}`);
    console.log('');

    const sites = EDGE_CASES.filter(e => e.category === cat);
    for (const site of sites) {
      const gt = groundTruth.find(g => g.name === site.name);
      const ch = chelipedRes.find(r => r.name === site.name);
      const pw = playwrightRes.find(r => r.name === site.name);
      const pp = puppeteerRes.find(r => r.name === site.name);

      console.log(`**${site.name}** (${site.url})`);

      if (!ch?.success) {
        console.log(`  Cheliped: ❌ ${ch?.error || 'not run'}`);
      } else {
        const gtLinks = gt?.links || 0;
        const linkRecall = gtLinks > 0 ? ((ch.links / gtLinks) * 100).toFixed(0) : '—';
        const gtBtns = gt?.buttons || 0;
        const btnRecall = gtBtns > 0 ? ((ch.buttons / gtBtns) * 100).toFixed(0) : '—';
        const gtInps = gt?.inputs || 0;
        const inpRecall = gtInps > 0 ? ((ch.inputs / gtInps) * 100).toFixed(0) : '—';
        const gtHdgs = gt?.headings || 0;
        const hdgRecall = gtHdgs > 0 ? ((ch.headings / gtHdgs) * 100).toFixed(0) : '—';

        console.log(`  Cheliped: ${ch.tokens} tok, ${ch.observeTime}ms | Links: ${ch.links}/${gtLinks} (${linkRecall}%) | Btns: ${ch.buttons}/${gtBtns} (${btnRecall}%) | Inputs: ${ch.inputs}/${gtInps} (${inpRecall}%) | Headings: ${ch.headings}/${gtHdgs} (${hdgRecall}%)`);
      }

      if (pw?.success) {
        console.log(`  Playwright: ${pw.tokens} tok, ${pw.observeTime}ms | Links: ${pw.links} | Btns: ${pw.buttons} | Inputs: ${pw.inputs} | Headings: ${pw.headings}`);
      }
      if (pp?.success) {
        console.log(`  Puppeteer: ${pp.tokens} tok, ${pp.observeTime}ms | Links: ${pp.links} | Btns: ${pp.buttons} | Inputs: ${pp.inputs} | Headings: ${pp.headings}`);
      }
      console.log('');
    }
  }

  // ─── Summary verdict ───────────────────────────────────────────

  console.log('═'.repeat(72));
  console.log('📋 LIMITATION VERDICT');
  console.log('═'.repeat(72));
  console.log('');

  const chSuccessCount = chelipedRes.filter(r => r.success).length;
  const pwSuccessCount = playwrightRes.filter(r => r.success).length;
  const ppSuccessCount = puppeteerRes.filter(r => r.success).length;

  console.log(`Navigation success: Cheliped ${chSuccessCount}/${EDGE_CASES.length} | Playwright ${pwSuccessCount}/${EDGE_CASES.length} | Puppeteer ${ppSuccessCount}/${EDGE_CASES.length}`);

  const chAvgTokens = chelipedRes.filter(r => r.success).reduce((s, r) => s + r.tokens, 0) / chSuccessCount || 0;
  const pwAvgTokens = playwrightRes.filter(r => r.success).reduce((s, r) => s + r.tokens, 0) / pwSuccessCount || 0;
  const ppAvgTokens = puppeteerRes.filter(r => r.success).reduce((s, r) => s + r.tokens, 0) / ppSuccessCount || 0;

  console.log(`Avg tokens: Cheliped ${Math.round(chAvgTokens)} | Playwright ${Math.round(pwAvgTokens)} | Puppeteer ${Math.round(ppAvgTokens)}`);

  const chAvgSpeed = chelipedRes.filter(r => r.success).reduce((s, r) => s + r.observeTime, 0) / chSuccessCount || 0;
  const pwAvgSpeed = playwrightRes.filter(r => r.success).reduce((s, r) => s + r.observeTime, 0) / pwSuccessCount || 0;
  const ppAvgSpeed = puppeteerRes.filter(r => r.success).reduce((s, r) => s + r.observeTime, 0) / ppSuccessCount || 0;

  console.log(`Avg speed: Cheliped ${Math.round(chAvgSpeed)}ms | Playwright ${Math.round(pwAvgSpeed)}ms | Puppeteer ${Math.round(ppAvgSpeed)}ms`);

  console.log('');
  console.log('Done. 🦀');
}

main().catch(err => {
  console.error('Limitation test failed:', err.message);
  process.exit(1);
});
