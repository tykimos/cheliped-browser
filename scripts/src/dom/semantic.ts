import type { InternalDomNode, SemanticElement } from '../types/internal-dom.types.js';

const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'li', 'td', 'th', 'label', 'span',
  'blockquote', 'figcaption',
]);

const ROLE_CATEGORY_MAP: Record<string, SemanticElement['category']> = {
  button: 'button',
  link: 'link',
  textbox: 'input',
  checkbox: 'input',
  radio: 'input',
};

export class SemanticExtractor {
  extract(node: InternalDomNode): SemanticElement[] {
    const results: SemanticElement[] = [];
    // Document node (nodeType 9) — recurse into children directly
    if (node.nodeType !== 1) {
      for (const child of node.children) {
        this.walk(child, results);
      }
    } else {
      this.walk(node, results);
    }
    return this.deduplicateHeadings(results);
  }

  private deduplicateHeadings(elements: SemanticElement[]): SemanticElement[] {
    const seenHeadingTexts = new Set<string>();
    return elements.filter((el) => {
      if (!el.tag) return true; // not a heading
      const text = (el.text ?? '').trim();
      if (!text) return false; // drop empty headings
      if (seenHeadingTexts.has(text)) return false; // duplicate
      seenHeadingTexts.add(text);
      return true;
    });
  }

  private walk(node: InternalDomNode, results: SemanticElement[], currentFormId?: number): void {
    // Only process element nodes
    if (node.nodeType !== 1) return;

    const el = this.tryExtract(node);
    if (el) {
      // Track form context: if this element is inside a form, record the formBackendNodeId
      if (currentFormId !== undefined && el.category !== 'form') {
        el.formBackendNodeId = currentFormId;
      }
      results.push(el);
      // Recurse into text-category containers (p, li, td, etc.) and forms
      // to find interactive elements (links, buttons) nested within them.
      // Skip recursing into leaves like button, input, a, img to avoid duplicates.
      const shouldRecurse =
        el.category === 'text' || el.category === 'form';
      if (shouldRecurse) {
        // When entering a form, pass its backendNodeId as the current form context
        const nextFormId = el.category === 'form' ? el.backendNodeId : currentFormId;
        for (const child of node.children) {
          this.walk(child, results, nextFormId);
        }
      }
      return;
    }

    for (const child of node.children) {
      this.walk(child, results, currentFormId);
    }
  }

  private tryExtract(node: InternalDomNode): SemanticElement | null {
    const { tagName, attributes, backendNodeId } = node;
    const role = attributes['role'];

    let category: SemanticElement['category'] | null = null;

    // Determine category by tag name
    if (tagName === 'button') {
      category = 'button';
    } else if (tagName === 'a' && attributes['href'] !== undefined) {
      category = 'link';
    } else if (tagName === 'input') {
      category = 'input';
    } else if (tagName === 'select') {
      category = 'select';
    } else if (tagName === 'textarea') {
      category = 'textarea';
    } else if (tagName === 'form') {
      category = 'form';
    } else if (tagName === 'img') {
      category = 'image';
    } else if (TEXT_TAGS.has(tagName)) {
      category = 'text';
    }

    // Override / set by ARIA role
    if (role && ROLE_CATEGORY_MAP[role]) {
      category = ROLE_CATEGORY_MAP[role];
    }

    // span with text only matters if it actually has text
    if (tagName === 'span' && category === 'text') {
      const text = this.getTextContent(node);
      if (!text) return null;
    }

    if (!category) return null;

    const text = this.getTextContent(node);

    const el: SemanticElement = {
      backendNodeId,
      category,
    };

    el.text = text;
    if (attributes['placeholder']) el.placeholder = attributes['placeholder'];
    if (attributes['href']) el.href = attributes['href'];
    if (attributes['src']) el.src = attributes['src'];
    if (attributes['name']) el.name = attributes['name'];
    if (attributes['value']) el.value = attributes['value'];
    if (attributes['type']) el.type = attributes['type'];
    if (/^h[1-6]$/.test(tagName)) el.tag = tagName;
    if (role) el.role = role;
    if (Object.keys(attributes).length > 0) el.attributes = { ...attributes };

    return el;
  }

  private getTextContent(node: InternalDomNode): string {
    const parts: string[] = [];
    this.collectText(node, parts);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private collectText(node: InternalDomNode, parts: string[]): void {
    if (node.nodeType === 3 && node.text) {
      const trimmed = node.text.trim();
      if (trimmed) parts.push(trimmed);
      return;
    }
    for (const child of node.children) {
      this.collectText(child, parts);
    }
  }
}
