import type { AgentDom } from './agent-dom.types.js';

export interface GotoResult {
  url: string;
  status: number;
  title: string;
}

export interface ObserveResult {
  agentDom: AgentDom;
}

export interface ActResult {
  success: boolean;
  action: 'click' | 'fill' | 'type' | 'focus' | 'press-key';
  agentId: number;
  selector?: string;
}

export interface ExtractResult {
  type: 'text' | 'links' | 'all';
  data: unknown;
}

export interface ScreenshotResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface DownloadResult {
  success: boolean;
  filePath: string;
  filename: string;
  size: number;
}

export interface ActSemanticResult {
  success: boolean;
  actionId: string;
  actionType: string;
}
