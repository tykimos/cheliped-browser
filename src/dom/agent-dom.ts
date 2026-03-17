import type { SemanticElement } from '../types/internal-dom.types.js';
import type { AgentDom, AgentDomNode } from '../types/agent-dom.types.js';
import type { CDPTransport } from '../cdp/transport.js';
import type { CompressionOptions } from '../types/options.types.js';
import { DomExtractor } from './extractor.js';
import { DomFilter } from './filter.js';
import { SemanticExtractor } from './semantic.js';
import { TokenCompressor } from './compressor.js';

export class AgentDomBuilder {
  private idMap: Map<number, number> = new Map(); // agentId → backendNodeId
  private extractor = new DomExtractor();
  private domFilter = new DomFilter();
  private semanticExtractor = new SemanticExtractor();

  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
  }

  build(elements: SemanticElement[], url: string, title: string): AgentDom {
    this.idMap.clear();
    let nextId = 1;

    const result: AgentDom = {
      url,
      title,
      buttons: [],
      links: [],
      inputs: [],
      selects: [],
      textareas: [],
      forms: [],
      texts: [],
      images: [],
      timestamp: Date.now(),
    };

    for (const el of elements) {
      const agentId = nextId++;
      this.idMap.set(agentId, el.backendNodeId);

      const node: AgentDomNode = {
        id: agentId,
        ...(el.text !== undefined && { text: el.text }),
        ...(el.placeholder && { placeholder: el.placeholder }),
        ...(el.href && { href: this.resolveUrl(el.href, url) }),
        ...(el.src && { src: el.src }),
        ...(el.name && { name: el.name }),
        ...(el.value && { value: el.value }),
        ...(el.type && { type: el.type }),
      };

      switch (el.category) {
        case 'button':
          result.buttons.push(node);
          break;
        case 'link':
          result.links.push(node);
          break;
        case 'input':
          result.inputs.push(node);
          break;
        case 'select':
          result.selects.push(node);
          break;
        case 'textarea':
          result.textareas.push(node);
          break;
        case 'form':
          result.forms.push(node);
          break;
        case 'text':
          result.texts.push(node);
          break;
        case 'image':
          result.images.push(node);
          break;
      }
    }

    return result;
  }

  resolveAgentId(agentId: number): number | undefined {
    return this.idMap.get(agentId);
  }

  async extractAgentDom(transport: CDPTransport, compression?: CompressionOptions): Promise<AgentDom> {
    const rawTree = await this.extractor.extractDomTree(transport);
    const filtered = this.domFilter.filter(rawTree);
    let elements = this.semanticExtractor.extract(filtered);

    // Token compression (Phase 2)
    if (compression && compression.enabled !== false) {
      const compressor = new TokenCompressor(compression);
      elements = compressor.compress(elements);
    }

    const [titleResult, urlResult] = await Promise.all([
      transport.send('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true,
      }),
      transport.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
      }),
    ]);

    const titleValue =
      (titleResult as { result?: { value?: string } })?.result?.value ?? '';
    const urlValue =
      (urlResult as { result?: { value?: string } })?.result?.value ?? '';

    return this.build(elements, urlValue, titleValue);
  }
}
