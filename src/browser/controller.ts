import { join } from 'path';
import type { GotoResult } from '../types/index.js';
import type { DownloadResult } from '../types/api.types.js';
import type { CDPTransport } from '../cdp/transport.js';
import { Page } from './page.js';

export class BrowserController {
  private page: Page;

  constructor(private transport: CDPTransport) {
    this.page = new Page(transport);
  }

  async goto(url: string, waitStrategy?: 'load' | 'networkIdle'): Promise<GotoResult> {
    return this.page.navigate(url, waitStrategy);
  }

  async click(selector: string): Promise<void> {
    // 1. Get root document node
    const docResult = await this.transport.send('DOM.getDocument', {
      depth: 0,
    }) as Record<string, unknown>;
    const root = docResult.root as Record<string, unknown>;
    const rootNodeId = root.nodeId as number;

    // 2. Find element by selector
    const queryResult = await this.transport.send('DOM.querySelector', {
      nodeId: rootNodeId,
      selector,
    }) as Record<string, unknown>;

    const nodeId = queryResult.nodeId as number;
    if (!nodeId) {
      throw new Error(`Element not found for selector: ${selector}`);
    }

    // 3. Get box model for coordinates
    const boxResult = await this.transport.send('DOM.getBoxModel', {
      nodeId,
    }) as Record<string, unknown>;

    const model = boxResult.model as Record<string, unknown>;
    const content = model.content as number[];

    // 4. Calculate center from quad [x1,y1,x2,y2,x3,y3,x4,y4]
    const x = (content[0] + content[2] + content[4] + content[6]) / 4;
    const y = (content[1] + content[3] + content[5] + content[7]) / 4;

    // 5. Dispatch mouse events
    await this._dispatchClick(x, y);
  }

  async clickByBackendNodeId(backendNodeId: number): Promise<void> {
    try {
      // 1. Get nodeId from backendNodeId
      const describeResult = await this.transport.send('DOM.describeNode', {
        backendNodeId,
      }) as Record<string, unknown>;
      const node = describeResult.node as Record<string, unknown>;
      const nodeId = node.nodeId as number;

      // 2. Get box model
      const boxResult = await this.transport.send('DOM.getBoxModel', {
        backendNodeId,
        nodeId,
      }) as Record<string, unknown>;

      const model = boxResult.model as Record<string, unknown>;
      const content = model.content as number[];

      // 3. Calculate center
      const x = (content[0] + content[2] + content[4] + content[6]) / 4;
      const y = (content[1] + content[3] + content[5] + content[7]) / 4;

      // 4. Dispatch mouse events
      await this._dispatchClick(x, y);
    } catch {
      // Fallback: scroll element into view and click via JS
      await this.transport.send('Runtime.evaluate', {
        expression: `
          (function() {
            const node = document.querySelector('[data-backend-node-id="${backendNodeId}"]');
            if (node) {
              node.scrollIntoView();
              node.click();
            }
          })()
        `,
        returnByValue: true,
      });
    }
  }

  private async _dispatchClick(x: number, y: number): Promise<void> {
    await this.transport.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.transport.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  }

  async fill(selector: string, text: string): Promise<void> {
    await this.transport.send('Runtime.evaluate', {
      expression: `
        (function() {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
          el.focus();
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(el, ${JSON.stringify(text)});
          } else {
            el.value = ${JSON.stringify(text)};
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `,
      returnByValue: true,
    });
  }

  async fillByBackendNodeId(backendNodeId: number, text: string): Promise<void> {
    // 1. Resolve node to get RemoteObject
    const resolveResult = await this.transport.send('DOM.resolveNode', {
      backendNodeId,
    }) as Record<string, unknown>;

    const remoteObject = resolveResult.object as Record<string, unknown>;
    const objectId = remoteObject.objectId as string;

    // 2. Focus the element first
    await this.transport.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: `function() { this.focus(); }`,
      returnByValue: true,
    });

    // 3. Clear existing value and type using Input.dispatchKeyEvent for React compatibility
    await this.transport.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: `
        function(value) {
          // Use native setter to bypass React's synthetic event system
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(this, value);
          } else {
            this.value = value;
          }
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `,
      arguments: [{ value: text }],
      returnByValue: true,
    });
  }

  async runJs(script: string): Promise<unknown> {
    const result = await this.transport.send('Runtime.evaluate', {
      expression: script,
      returnByValue: true,
    }) as Record<string, unknown>;

    if (result.exceptionDetails) {
      const details = result.exceptionDetails as Record<string, unknown>;
      const exceptionText = details.text as string | undefined;
      throw new Error(`JavaScript error: ${exceptionText ?? 'Unknown error'}`);
    }

    const r = result.result as Record<string, unknown> | undefined;
    return r?.value;
  }

  async screenshot(): Promise<Buffer> {
    const result = await this.transport.send('Page.captureScreenshot', {
      format: 'png',
    }) as Record<string, unknown>;

    const data = result.data as string;
    return Buffer.from(data, 'base64');
  }

  async setupDownloads(downloadPath: string): Promise<void> {
    await this.transport.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath,
      eventsEnabled: true,
    });
  }

  async download(url: string, downloadPath: string, timeout: number = 60000): Promise<DownloadResult> {
    await this.setupDownloads(downloadPath);

    return new Promise<DownloadResult>((resolve, reject) => {
      let downloadGuid: string | null = null;
      let filename = '';
      let timeoutTimer: ReturnType<typeof setTimeout>;
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        this.transport.off('Browser.downloadWillBegin', onBegin);
        this.transport.off('Browser.downloadProgress', onProgress);
      };

      const onBegin = (params: any) => {
        downloadGuid = params.guid;
        filename = params.suggestedFilename || 'download';
      };

      const onProgress = (params: any) => {
        if (params.guid !== downloadGuid) return;
        if (params.state === 'completed') {
          cleanup();
          const filePath = join(downloadPath, filename);
          resolve({
            success: true,
            filePath,
            filename,
            size: params.receivedBytes || 0,
          });
        } else if (params.state === 'canceled') {
          cleanup();
          reject(new Error('Download was canceled'));
        }
      };

      this.transport.on('Browser.downloadWillBegin', onBegin);
      this.transport.on('Browser.downloadProgress', onProgress);

      timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error(`Download timed out after ${timeout}ms`));
      }, timeout);

      // Navigate to the download URL to trigger the download
      this.transport.send('Page.navigate', { url }).catch(err => {
        cleanup();
        reject(err);
      });
    });
  }

  async downloadByClick(backendNodeId: number, downloadPath: string, timeout: number = 60000): Promise<DownloadResult> {
    await this.setupDownloads(downloadPath);

    return new Promise<DownloadResult>((resolve, reject) => {
      let downloadGuid: string | null = null;
      let filename = '';
      let timeoutTimer: ReturnType<typeof setTimeout>;
      let settled = false;

      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        this.transport.off('Browser.downloadWillBegin', onBegin);
        this.transport.off('Browser.downloadProgress', onProgress);
      };

      const onBegin = (params: any) => {
        downloadGuid = params.guid;
        filename = params.suggestedFilename || 'download';
      };

      const onProgress = (params: any) => {
        if (params.guid !== downloadGuid) return;
        if (params.state === 'completed') {
          cleanup();
          resolve({
            success: true,
            filePath: join(downloadPath, filename),
            filename,
            size: params.receivedBytes || 0,
          });
        } else if (params.state === 'canceled') {
          cleanup();
          reject(new Error('Download was canceled'));
        }
      };

      this.transport.on('Browser.downloadWillBegin', onBegin);
      this.transport.on('Browser.downloadProgress', onProgress);

      timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error(`Download timed out after ${timeout}ms`));
      }, timeout);

      // Click the element to trigger download
      this.clickByBackendNodeId(backendNodeId).catch(err => {
        cleanup();
        reject(err);
      });
    });
  }
}
