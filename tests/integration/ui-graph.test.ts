import { describe, it, expect, afterEach } from 'vitest';
import { Cheliped } from '../../src/api/cheliped.js';

describe('UI Graph Integration', () => {
  let cheliped: Cheliped;

  afterEach(async () => {
    if (cheliped) await cheliped.close().catch(() => {});
  });

  it('should build UI Graph from a real page', async () => {
    cheliped = new Cheliped({ headless: true });
    await cheliped.launch();
    await cheliped.goto('https://example.com');

    const graph = await cheliped.observeGraph();
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.url).toContain('example.com');
    expect(graph.title).toContain('Example');

    // Should have links
    const linkNodes = graph.nodes.filter(n => n.type === 'link');
    expect(linkNodes.length).toBeGreaterThan(0);
  });

  it('should generate semantic actions', async () => {
    cheliped = new Cheliped({ headless: true });
    await cheliped.launch();
    await cheliped.goto('https://example.com');

    const actions = await cheliped.actions();
    // example.com has at least one link, so should have open_link actions
    const linkActions = actions.filter(a => a.type === 'open_link');
    expect(linkActions.length).toBeGreaterThan(0);
  });
});
