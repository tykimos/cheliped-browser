import type Protocol from 'devtools-protocol';
import type { CDPTransport } from '../cdp/transport.js';
import type { InternalDomNode } from '../types/internal-dom.types.js';

/** Minimal shape of a frame returned by Page.getFrameTree */
interface FrameInfo {
  frame: { id: string };
  childFrames?: FrameInfo[];
}

export class DomExtractor {
  async extractDomTree(transport: CDPTransport): Promise<InternalDomNode> {
    const response = (await transport.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    })) as { root: Protocol.DOM.Node };

    const mainNode = this.convertNode(response.root);

    // Extract iframe content and merge into the main document body
    try {
      const iframeNodes = await this.extractIframeContent(transport);
      if (iframeNodes.length > 0) {
        // Inject iframe nodes as additional children of the root's html/body
        this.mergeIframeNodes(mainNode, iframeNodes);
      }
    } catch {
      // Best-effort: if frame extraction fails, return main frame only
    }

    return mainNode;
  }

  /** Collect all child frame IDs recursively from the frame tree. */
  private collectChildFrameIds(frame: FrameInfo, ids: string[]): void {
    if (frame.childFrames) {
      for (const child of frame.childFrames) {
        ids.push(child.frame.id);
        this.collectChildFrameIds(child, ids);
      }
    }
  }

  /** Use Runtime.evaluate in an iframe's isolated world to extract interactive elements. */
  private async extractIframeContent(transport: CDPTransport): Promise<InternalDomNode[]> {
    const frameTreeResult = (await transport.send('Page.getFrameTree', {})) as {
      frameTree: FrameInfo;
    };

    const childFrameIds: string[] = [];
    this.collectChildFrameIds(frameTreeResult.frameTree, childFrameIds);

    if (childFrameIds.length === 0) return [];

    const results: InternalDomNode[] = [];

    for (const frameId of childFrameIds) {
      try {
        // Create an isolated world for the frame to get an executionContextId
        const worldResult = (await transport.send('Page.createIsolatedWorld', {
          frameId,
          grantUniversalAccess: true,
        })) as { executionContextId: number };

        const contextId = worldResult.executionContextId;

        // Query all interactive elements in this frame
        const evalResult = (await transport.send('Runtime.evaluate', {
          expression: `(function() {
            const SELECTORS = 'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="textbox"], h1, h2, h3, h4, h5, h6, p, li, label';
            const els = Array.from(document.querySelectorAll(SELECTORS));
            return els.map(function(el) {
              const attrs = {};
              for (const a of el.attributes) { attrs[a.name] = a.value; }
              return {
                tagName: el.tagName.toLowerCase(),
                textContent: (el.textContent || '').trim().slice(0, 200),
                attributes: attrs,
              };
            });
          })()`,
          contextId,
          returnByValue: true,
          awaitPromise: false,
        })) as { result?: { value?: unknown }; exceptionDetails?: unknown };

        if (evalResult.exceptionDetails) continue;

        const elements = evalResult.result?.value as Array<{
          tagName: string;
          textContent: string;
          attributes: Record<string, string>;
        }> | undefined;

        if (!elements || !Array.isArray(elements)) continue;

        for (const el of elements) {
          const children: InternalDomNode[] = [];

          // If the element has text, add a text child node
          if (el.textContent) {
            children.push({
              backendNodeId: 0,
              nodeType: 3,
              tagName: '#text',
              attributes: {},
              text: el.textContent,
              children: [],
            });
          }

          results.push({
            backendNodeId: 0,
            nodeType: 1,
            tagName: el.tagName,
            attributes: el.attributes,
            children,
          });
        }
      } catch {
        // Skip frames that are cross-origin or otherwise inaccessible
      }
    }

    return results;
  }

  /** Merge iframe nodes into the main document tree (appended to body or html). */
  private mergeIframeNodes(root: InternalDomNode, iframeNodes: InternalDomNode[]): void {
    // Walk root to find body; if not found, append to root itself
    const body = this.findNode(root, 'body');
    const target = body ?? root;
    target.children.push(...iframeNodes);
  }

  private findNode(node: InternalDomNode, tagName: string): InternalDomNode | null {
    if (node.tagName === tagName) return node;
    for (const child of node.children) {
      const found = this.findNode(child, tagName);
      if (found) return found;
    }
    return null;
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
