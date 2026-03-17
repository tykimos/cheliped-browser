import type { ChelipedOptions, LaunchResult } from '../types/index.js';
import { ChromeLauncher } from './launcher.js';
import { CDPTransport } from './transport.js';

export class CDPConnection {
  private launcher: ChromeLauncher;
  private transport: CDPTransport;
  private launchResult: LaunchResult | null = null;
  private ownsProcess: boolean = true;

  constructor() {
    this.launcher = new ChromeLauncher();
    this.transport = new CDPTransport();
  }

  async connect(options?: ChelipedOptions, userDataDir?: string): Promise<void> {
    this.launchResult = await this.launcher.launch(options ?? {}, userDataDir);
    this.ownsProcess = true;
    await this.transport.connect(this.launchResult.wsUrl);
    await this._enableDomains();
  }

  /** 기존 Chrome 인스턴스에 재연결 (포트로 페이지 타겟 검색) */
  async reconnect(port: number): Promise<void> {
    const listUrl = `http://localhost:${port}/json/list`;
    const res = await fetch(listUrl);
    if (!res.ok) throw new Error(`Chrome not reachable on port ${port}`);
    const targets = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
    const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error(`No page target found on port ${port}`);
    }
    this.ownsProcess = false;
    await this.transport.connect(pageTarget.webSocketDebuggerUrl);
    await this._enableDomains();
  }

  getLaunchResult(): LaunchResult | null {
    return this.launchResult;
  }

  getTransport(): CDPTransport {
    return this.transport;
  }

  /** WebSocket만 끊고 Chrome 프로세스는 유지 */
  async detach(): Promise<void> {
    await this.transport.disconnect();
  }

  /** Chrome 프로세스까지 완전 종료 */
  async disconnect(): Promise<void> {
    await this.transport.disconnect();
    if (this.ownsProcess) {
      await this.launcher.kill();
    }
  }

  private async _enableDomains(): Promise<void> {
    await Promise.all([
      this.transport.send('Page.enable'),
      this.transport.send('DOM.enable'),
      this.transport.send('Runtime.enable'),
      this.transport.send('Network.enable'),
    ]);
  }
}
