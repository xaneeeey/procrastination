import type { Api } from '../electron/preload';

declare global {
  interface Window {
    api: Api;
  }
}

export type DirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

export type Settings = {
  workspacePath: string | null;
  theme: 'warm-light' | 'warm-dark';
  browser: {
    provider: 'instagram' | 'youtube';
    mode: 'off' | 'monitored' | 'full';
  };
  ai: {
    claude: { bypassPermissions: boolean };
    codex: { bypassPermissions: boolean };
  };
  runCommands: Record<string, string>;
};

export type OpenFile = {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  externalChangePending: boolean;
};

export type AiProvider = 'claude' | 'codex';

export {};
