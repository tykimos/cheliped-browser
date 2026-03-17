import type Protocol from 'devtools-protocol';
import type { CDPTransport } from '../cdp/transport.js';
import type { InternalDomNode } from '../types/internal-dom.types.js';

export class DomExtractor {
  async extractDomTree(transport: CDPTransport): Promise<InternalDomNode> {
    const response = (await transport.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    })) as { root: Protocol.DOM.Node };

    return this.convertNode(response.root);
  }

  private convertNode(node: Protocol.DOM.Node): InternalDomNode {
    const attributes = this.convertAttributes(node.attributes);

    let tagName: string;
    if (node.nodeType === 3) {
      tagName = '#text';
    } else if (node.nodeType === 8) {
      tagName = '#comment';
    } else {
      tagName = node.nodeName.toLowerCase();
    }

    const children: InternalDomNode[] = [];

    if (node.children) {
      for (const child of node.children) {
        children.push(this.convertNode(child));
      }
    }

    // Handle iframes — include contentDocument children
    if (node.contentDocument) {
      const contentNode = this.convertNode(node.contentDocument);
      children.push(contentNode);
    }

    // Handle shadow roots
    if (node.shadowRoots) {
      for (const shadowRoot of node.shadowRoots) {
        const shadowNode = this.convertNode(shadowRoot);
        children.push(shadowNode);
      }
    }

    const result: InternalDomNode = {
      backendNodeId: node.backendNodeId,
      nodeType: node.nodeType,
      tagName,
      attributes,
      children,
    };

    if (node.nodeType === 3 && node.nodeValue !== undefined) {
      result.text = node.nodeValue;
    }

    return result;
  }

  private convertAttributes(
    flatAttrs: string[] | undefined
  ): Record<string, string> {
    if (!flatAttrs) return {};
    const result: Record<string, string> = {};
    for (let i = 0; i + 1 < flatAttrs.length; i += 2) {
      result[flatAttrs[i]] = flatAttrs[i + 1];
    }
    return result;
  }
}
