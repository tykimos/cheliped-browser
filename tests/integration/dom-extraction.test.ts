import { describe, it, expect, afterEach } from 'vitest';
import { Cheliped } from '../../src/api/cheliped.js';

describe('DOM Extraction', () => {
  let cheliped: Cheliped;

  afterEach(async () => {
    if (cheliped) {
      await cheliped.close().catch(() => {});
    }
  });

  it('should extract Agent DOM with grouped structure', async () => {
    cheliped = new Cheliped({ headless: true });
    await cheliped.launch();
    await cheliped.goto('https://example.com');

    const agentDom = await cheliped.observe();

    // Verify grouped structure
    expect(agentDom).toHaveProperty('buttons');
    expect(agentDom).toHaveProperty('links');
    expect(agentDom).toHaveProperty('inputs');
    expect(agentDom).toHaveProperty('texts');
    expect(agentDom).toHaveProperty('images');
    expect(agentDom).toHaveProperty('url');
    expect(agentDom).toHaveProperty('title');
    expect(agentDom).toHaveProperty('timestamp');

    // example.com has a link (text varies by locale/version, e.g. "More information..." or "Learn more")
    expect(agentDom.links.length).toBeGreaterThan(0);
    const firstLink = agentDom.links[0];
    expect(firstLink).toBeDefined();
    expect(firstLink.href).toBeDefined();

    // Should have text content
    expect(agentDom.texts.length).toBeGreaterThan(0);

    // All elements should have IDs
    const allElements = [
      ...agentDom.buttons, ...agentDom.links, ...agentDom.inputs,
      ...agentDom.texts, ...agentDom.images,
    ];
    for (const el of allElements) {
      expect(el.id).toBeGreaterThan(0);
    }
  });

  it('should enforce observe-before-act', async () => {
    cheliped = new Cheliped({ headless: true });
    await cheliped.launch();
    await cheliped.goto('https://example.com');

    // act() without observe() should fail
    await expect(cheliped.act(1, 'click')).rejects.toThrow(/observe/i);

    // After observe(), act() with valid ID should work
    const agentDom = await cheliped.observe();
    if (agentDom.links.length > 0) {
      const linkId = agentDom.links[0].id;
      // Just verify the ID resolves (click may navigate away)
      await expect(cheliped.act(linkId, 'click')).resolves.toBeDefined();
    }
  });
});
