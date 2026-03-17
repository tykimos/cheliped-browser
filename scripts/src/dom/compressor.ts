import type { SemanticElement } from '../types/internal-dom.types.js';
import type { CompressionOptions } from '../types/options.types.js';
import type { AgentDom } from '../types/agent-dom.types.js';

const DEFAULTS: Required<CompressionOptions> = {
  enabled: true,
  maxTextLength: 300,
  maxListItems: 30,
  maxLinks: 20,
  maxImages: 10,
  excludeEmptyTexts: true,
  deduplicateLinks: true,
};

export class TokenCompressor {
  private opts: Required<CompressionOptions>;

  constructor(options?: CompressionOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  compress(elements: SemanticElement[]): SemanticElement[] {
    let result = [...elements];

    // 1. Remove empty text elements
    if (this.opts.excludeEmptyTexts) {
      result = result.filter(el => {
        if (el.category === 'text') {
          return el.text && el.text.trim().length > 0;
        }
        return true;
      });
    }

    // 2. Truncate long text
    result = result.map(el => {
      if (el.text && el.text.length > this.opts.maxTextLength) {
        return { ...el, text: el.text.slice(0, this.opts.maxTextLength) + '...' };
      }
      return el;
    });

    // 3. Deduplicate links (same href)
    if (this.opts.deduplicateLinks) {
      const seenHrefs = new Set<string>();
      result = result.filter(el => {
        if (el.category === 'link' && el.href) {
          if (seenHrefs.has(el.href)) return false;
          seenHrefs.add(el.href);
        }
        return true;
      });
    }

    // 4. Limit links
    let linkCount = 0;
    result = result.filter(el => {
      if (el.category === 'link') {
        linkCount++;
        return linkCount <= this.opts.maxLinks;
      }
      return true;
    });

    // 5. Limit images
    let imageCount = 0;
    result = result.filter(el => {
      if (el.category === 'image') {
        imageCount++;
        return imageCount <= this.opts.maxImages;
      }
      return true;
    });

    // 6. Limit repeated list items (consecutive text elements from same parent)
    result = this.limitRepeatedItems(result);

    // 7. Strip non-essential attributes
    result = result.map(el => {
      if (el.attributes) {
        const kept: Record<string, string> = {};
        for (const key of ['id', 'class', 'role', 'data-testid']) {
          if (el.attributes[key]) kept[key] = el.attributes[key];
        }
        return { ...el, attributes: Object.keys(kept).length > 0 ? kept : undefined };
      }
      return el;
    });

    return result;
  }

  private limitRepeatedItems(elements: SemanticElement[]): SemanticElement[] {
    // Find consecutive runs of same-category elements and limit them
    const result: SemanticElement[] = [];
    let runCategory: string | null = null;
    let runCount = 0;

    for (const el of elements) {
      if (el.category === runCategory) {
        runCount++;
        if (runCount <= this.opts.maxListItems) {
          result.push(el);
        }
        // Skip elements beyond maxListItems in the same run
      } else {
        runCategory = el.category;
        runCount = 1;
        result.push(el);
      }
    }

    return result;
  }
}

export function estimateTokens(agentDom: AgentDom): number {
  return Math.ceil(JSON.stringify(agentDom).length / 4);
}
