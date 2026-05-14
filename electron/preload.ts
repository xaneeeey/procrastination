import { contextBridge, ipcRenderer } from 'electron';

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
    autoOpen: boolean;
  };
  ai: {
    claude: { bypassPermissions: boolean };
    codex: { bypassPermissions: boolean };
  };
  runCommands: Record<string, string>;
};

const api = {
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
  },
  workspace: {
    pick: (): Promise<string | null> => ipcRenderer.invoke('workspace:pick'),
    get: (): Promise<string | null> => ipcRenderer.invoke('workspace:get'),
  },
  fs: {
    listDir: (dirPath: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:listDir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, contents: string): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', filePath, contents),
    createFile: (filePath: string): Promise<void> => ipcRenderer.invoke('fs:createFile', filePath),
    createDir: (dirPath: string): Promise<void> => ipcRenderer.invoke('fs:createDir', dirPath),
    rename: (oldPath: string, newPath: string): Promise<void> =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),
    delete: (targetPath: string): Promise<void> => ipcRenderer.invoke('fs:delete', targetPath),
    stat: (p: string): Promise<{ exists: boolean; isDirectory: boolean; mtimeMs: number; size: number }> =>
      ipcRenderer.invoke('fs:stat', p),
    watchFile: (filePath: string): Promise<void> => ipcRenderer.invoke('fs:watchFile', filePath),
    unwatchFile: (filePath: string): Promise<void> => ipcRenderer.invoke('fs:unwatchFile', filePath),
    watchWorkspace: (dirPath: string): Promise<void> => ipcRenderer.invoke('fs:watchWorkspace', dirPath),
    onFileChanged: (cb: (filePath: string) => void) => {
      const listener = (_: unknown, filePath: string) => cb(filePath);
      ipcRenderer.on('fs:fileChanged', listener);
      return () => { ipcRenderer.off('fs:fileChanged', listener); };
    },
    onWorkspaceChanged: (cb: (payload: { path: string }) => void) => {
      const listener = (_: unknown, payload: { path: string }) => cb(payload);
      ipcRenderer.on('fs:workspaceChanged', listener);
      return () => { ipcRenderer.off('fs:workspaceChanged', listener); };
    },
  },
  pty: {
    spawn: (opts: { id: string; shell?: string; args?: string[]; cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }): Promise<{ id: string; pid: number }> =>
      ipcRenderer.invoke('pty:spawn', opts),
    write: (id: string, data: string): Promise<void> => ipcRenderer.invoke('pty:write', id, data),
    resize: (id: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('pty:resize', id, cols, rows),
    kill: (id: string): Promise<void> => ipcRenderer.invoke('pty:kill', id),
    onData: (id: string, cb: (data: string) => void) => {
      const channel = `pty:data:${id}`;
      const listener = (_: unknown, data: string) => cb(data);
      ipcRenderer.on(channel, listener);
      return () => { ipcRenderer.off(channel, listener); };
    },
    onExit: (id: string, cb: (exitCode: number) => void) => {
      const channel = `pty:exit:${id}`;
      const listener = (_: unknown, code: number) => cb(code);
      ipcRenderer.on(channel, listener);
      return () => { ipcRenderer.off(channel, listener); };
    },
  },
  app: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
    getHomeDir: (): Promise<string> => ipcRenderer.invoke('app:getHomeDir'),
    resolvePath: (...parts: string[]): Promise<string> => ipcRenderer.invoke('app:resolvePath', ...parts),
    dirname: (p: string): Promise<string> => ipcRenderer.invoke('app:dirname', p),
    basename: (p: string, ext?: string): Promise<string> => ipcRenderer.invoke('app:basename', p, ext),
    extname: (p: string): Promise<string> => ipcRenderer.invoke('app:extname', p),
    platform: process.platform as NodeJS.Platform,
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
