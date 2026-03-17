import { tmpdir } from 'os';
import { CDPConnection } from '../cdp/connection.js';
import { BrowserController } from '../browser/controller.js';
import { AgentDomBuilder } from '../dom/agent-dom.js';
import { DomExtractor } from '../dom/extractor.js';
import { DomFilter } from '../dom/filter.js';
import { SemanticExtractor } from '../dom/semantic.js';
import { TokenCompressor } from '../dom/compressor.js';
import { UIGraphBuilder } from '../graph/ui-graph.js';
import { ActionGenerator } from '../graph/action-generator.js';
import { SessionManager } from '../session/session-manager.js';
import { SecurityLayer } from '../security/security-layer.js';
import { PromptGuard } from '../security/prompt-guard.js';
import type { ChelipedOptions, LaunchResult } from '../types/options.types.js';
import type { AgentDom } from '../types/agent-dom.types.js';
import type { GotoResult, ActResult, ExtractResult, ScreenshotResult, DownloadResult, ActSemanticResult } from '../types/api.types.js';
import type { UIGraph } from '../graph/ui-graph.types.js';
import type { SemanticAction } from '../graph/action.types.js';

export class Cheliped {
  private options: ChelipedOptions;
  private connection: CDPConnection | null = null;
  private controller: BrowserController | null = null;
  private agentDomBuilder: AgentDomBuilder = new AgentDomBuilder();
  private graphBuilder = new UIGraphBuilder();
  private actionGenerator = new ActionGenerator();
  private sessionManager: SessionManager | null = null;
  private securityLayer: SecurityLayer | null = null;
  private promptGuard: PromptGuard | null = null;

  constructor(options?: ChelipedOptions) {
    this.options = { headless: true, ...options };
  }

  async launch(): Promise<void> {
    let userDataDir: string | undefined;

    // Set up session manager if session options provided
    if (this.options.session) {
      this.sessionManager = new SessionManager(this.options.session);
      const profile = await this.sessionManager.initialize();
      userDataDir = profile.userDataDir;
    }

    this.connection = new CDPConnection();
    await this.connection.connect(this.options, userDataDir);
    this.controller = new BrowserController(this.connection.getTransport());

    // Restore cookies if session has persistCookies
    if (this.sessionManager && this.options.session?.persistCookies) {
      await this.sessionManager.restoreCookies(this.connection.getTransport());
    }

    // Set up security layer if security options provided
    if (this.options.security) {
      this.securityLayer = new SecurityLayer(this.options.security);
      await this.securityLayer.attachToTransport(this.connection.getTransport());

      if (this.options.security.enablePromptGuard) {
        this.promptGuard = new PromptGuard();
      }
    }
  }

  async goto(url: string): Promise<GotoResult> {
    this.ensureLaunched();
    if (this.securityLayer) {
      const validation = this.securityLayer.validateNavigation(url);
      if (!validation.allowed) {
        throw new Error(`Navigation blocked: ${validation.reason}`);
      }
      this.securityLayer.setInitialDomain(url);
    }
    return this.controller!.goto(url, this.options.waitStrategy);
  }

  async observe(): Promise<AgentDom> {
    this.ensureLaunched();
    return this.agentDomBuilder.extractAgentDom(
      this.connection!.getTransport(),
      this.options.compression,
    );
  }

  async observeGraph(): Promise<UIGraph> {
    this.ensureLaunched();
    const transport = this.connection!.getTransport();

    const extractor = new DomExtractor();
    const domFilter = new DomFilter();
    const semanticExtractor = new SemanticExtractor();

    const rawTree = await extractor.extractDomTree(transport);
    const filtered = domFilter.filter(rawTree);
    let elements = semanticExtractor.extract(filtered);

    if (this.options.compression && this.options.compression.enabled !== false) {
      const compressor = new TokenCompressor(this.options.compression);
      elements = compressor.compress(elements);
    }

    const [titleResult, urlResult] = await Promise.all([
      transport.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }),
      transport.send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true }),
    ]);

    const title = (titleResult as { result?: { value?: string } })?.result?.value || '';
    const url = (urlResult as { result?: { value?: string } })?.result?.value || '';

    const graph = this.graphBuilder.build(elements, url, title);

    // Sync agentDomBuilder's idMap so act() works with graph node IDs
    this.agentDomBuilder.build(elements, url, title);

    return graph;
  }

  async actions(): Promise<SemanticAction[]> {
    this.ensureLaunched();
    const graph = await this.observeGraph();
    return this.actionGenerator.generate(graph);
  }

  async perform(actionId: string, params?: Record<string, string>): Promise<ActSemanticResult> {
    this.ensureLaunched();
    const allActions = await this.actions();
    const action = allActions.find(a => a.id === actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}. Available: ${allActions.map(a => a.id).join(', ')}`);
    }

    // Fill params
    if (params) {
      for (const param of action.params) {
        const value = params[param.name];
        if (value !== undefined) {
          await this.act(param.nodeId, 'fill', value);
        }
      }
    }

    // Click trigger
    await this.act(action.triggerNodeId, 'click');

    return {
      success: true,
      actionId: action.id,
      actionType: action.type,
    };
  }

  async act(agentId: number, action: 'click' | 'fill', value?: string): Promise<ActResult> {
    this.ensureLaunched();
    const backendNodeId = this.agentDomBuilder.resolveAgentId(agentId);
    if (backendNodeId === undefined) {
      throw new Error(`Agent DOM ID ${agentId} not found. Call observe() first to get current Agent DOM.`);
    }

    if (action === 'click') {
      await this.controller!.clickByBackendNodeId(backendNodeId);
    } else if (action === 'fill') {
      if (value === undefined) {
        throw new Error('value is required for fill action');
      }
      await this.controller!.fillByBackendNodeId(backendNodeId, value);
    }

    return { success: true, action, agentId };
  }

  async click(agentId: number): Promise<ActResult> {
    return this.act(agentId, 'click');
  }

  async fill(agentId: number, value: string): Promise<ActResult> {
    return this.act(agentId, 'fill', value);
  }

  /** Human-like typing: types character by character with random delays (50-150ms). */
  async fillHuman(agentId: number, value: string): Promise<ActResult> {
    this.ensureLaunched();
    const backendNodeId = this.agentDomBuilder.resolveAgentId(agentId);
    if (backendNodeId === undefined) {
      throw new Error(`Agent DOM ID ${agentId} not found. Call observe() first to get current Agent DOM.`);
    }
    await this.controller!.fillHumanByBackendNodeId(backendNodeId, value);
    return { success: true, action: 'fill', agentId };
  }

  /** Select a <select> option by visible text or value. */
  async selectOption(agentId: number, optionValue: string): Promise<ActResult> {
    this.ensureLaunched();
    const backendNodeId = this.agentDomBuilder.resolveAgentId(agentId);
    if (backendNodeId === undefined) {
      throw new Error(`Agent DOM ID ${agentId} not found. Call observe() first to get current Agent DOM.`);
    }
    await this.controller!.selectByBackendNodeId(backendNodeId, optionValue);
    return { success: true, action: 'click', agentId };
  }

  async extract(type: 'text' | 'links' | 'all'): Promise<ExtractResult> {
    this.ensureLaunched();
    const transport = this.connection!.getTransport();

    // Fast path: use lightweight JS extraction for text/links instead of full DOM pipeline
    if (type === 'text') {
      const result = await transport.send('Runtime.evaluate', {
        expression: `(function() {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const texts = [];
          let node;
          while (node = walker.nextNode()) {
            const t = node.textContent.trim();
            if (t && t.length > 1) {
              const style = window.getComputedStyle(node.parentElement);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                texts.push({ text: t.slice(0, 300) });
              }
            }
          }
          return texts.slice(0, 2000);
        })()`,
        returnByValue: true,
      });
      const data = (result as { result?: { value?: unknown } })?.result?.value ?? [];
      return { type, data };
    }

    if (type === 'links') {
      const result = await transport.send('Runtime.evaluate', {
        expression: `(function() {
          const links = Array.from(document.querySelectorAll('a[href]'));
          const seen = new Set();
          return links.reduce(function(acc, a) {
            const href = a.href;
            if (!href || seen.has(href)) return acc;
            seen.add(href);
            const text = (a.textContent || '').trim().slice(0, 200);
            if (text) acc.push({ text: text, href: href });
            return acc;
          }, []).slice(0, 5000);
        })()`,
        returnByValue: true,
      });
      const data = (result as { result?: { value?: unknown } })?.result?.value ?? [];
      return { type, data };
    }

    // type === 'all': full pipeline
    const agentDom = await this.observe();
    return { type, data: agentDom };
  }

  async screenshot(): Promise<ScreenshotResult> {
    this.ensureLaunched();
    const buffer = await this.controller!.screenshot();
    return { buffer, width: 0, height: 0 };
  }

  async runJs(script: string): Promise<unknown> {
    this.ensureLaunched();
    return this.controller!.runJs(script);
  }

  async download(url: string): Promise<DownloadResult> {
    this.ensureLaunched();
    const downloadPath = this.options.downloadPath || tmpdir();
    return this.controller!.download(url, downloadPath);
  }

  getSecurityViolations() {
    return this.securityLayer?.getViolations() || [];
  }

  async checkPromptInjection(): Promise<{ injectionDetected: boolean; patterns: string[] }> {
    this.ensureLaunched();
    if (!this.promptGuard) return { injectionDetected: false, patterns: [] };
    const text = await this.runJs('document.body.innerText');
    return this.promptGuard.detect(text as string || '');
  }

  /** 기존 Chrome 인스턴스에 재연결 (포트 기반) */
  async reconnect(port: number): Promise<void> {
    this.connection = new CDPConnection();
    await this.connection.reconnect(port);
    this.controller = new BrowserController(this.connection.getTransport());
  }

  /** WebSocket만 끊고 Chrome은 살려둠 (세션 유지) */
  async detach(): Promise<void> {
    if (this.connection) {
      await this.connection.detach();
      this.connection = null;
      this.controller = null;
    }
  }

  /** launch() 후 연결 정보 반환 (port, pid, wsUrl) */
  getLaunchResult(): LaunchResult | null {
    return this.connection?.getLaunchResult() ?? null;
  }

  async close(): Promise<void> {
    if (this.connection && this.sessionManager) {
      try {
        await this.sessionManager.saveCookies(this.connection.getTransport());
      } catch {
        // Best effort
      }
    }
    if (this.connection) {
      await this.connection.disconnect();
      this.connection = null;
      this.controller = null;
    }
  }

  private ensureLaunched(): void {
    if (!this.connection || !this.controller) {
      throw new Error('Cheliped not launched. Call launch() first.');
    }
  }
}
