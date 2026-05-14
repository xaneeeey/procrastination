import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { createPtyManager, PtyManager } from './pty-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vite dev server URL (set by vite-plugin-electron in dev) or built index.html
const DEV_URL = process.env['VITE_DEV_SERVER_URL'];

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

type Settings = {
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
  runCommands: Record<string, string>; // ext (with dot) → command template
};

const DEFAULT_SETTINGS: Settings = {
  workspacePath: null,
  theme: 'warm-light',
  browser: {
    provider: 'instagram',
    autoOpen: true,
  },
  ai: {
    claude: { bypassPermissions: false },
    codex: { bypassPermissions: false },
  },
  runCommands: {
    '.py': 'python3 "$file"',
    '.js': 'node "$file"',
    '.ts': 'npx tsx "$file"',
    '.sh': 'bash "$file"',
    '.cpp': 'g++ -O2 -std=c++20 "$file" -o "$dir/$fileBase" && "$dir/$fileBase"',
    '.c': 'gcc -O2 "$file" -o "$dir/$fileBase" && "$dir/$fileBase"',
    '.rs': 'rustc "$file" -o "$dir/$fileBase" && "$dir/$fileBase"',
    '.go': 'go run "$file"',
    '.rb': 'ruby "$file"',
    '.java': 'cd "$dir" && javac "$file" && java "$fileBase"',
  },
};

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, browser: { ...DEFAULT_SETTINGS.browser, ...(parsed.browser || {}) }, ai: { ...DEFAULT_SETTINGS.ai, ...(parsed.ai || {}) }, runCommands: { ...DEFAULT_SETTINGS.runCommands, ...(parsed.runCommands || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
}

let mainWindow: BrowserWindow | null = null;
let ptyManager: PtyManager | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#FBF7F0',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  ptyManager = createPtyManager((id, payload) => {
    mainWindow?.webContents.send(`pty:data:${id}`, payload);
  }, (id, exitCode) => {
    mainWindow?.webContents.send(`pty:exit:${id}`, exitCode);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyManager?.killAll();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Settings IPC ──────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async () => loadSettings());

ipcMain.handle('settings:set', async (_, patch: Partial<Settings>) => {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await saveSettings(next);
  return next;
});

// ─── Workspace IPC ─────────────────────────────────────────────────────────

ipcMain.handle('workspace:pick', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Pick a workspace folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const next = await loadSettings();
  next.workspacePath = result.filePaths[0];
  await saveSettings(next);
  return next.workspacePath;
});

ipcMain.handle('workspace:get', async () => {
  const s = await loadSettings();
  return s.workspacePath;
});

// ─── Filesystem IPC ────────────────────────────────────────────────────────

type DirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

ipcMain.handle('fs:listDir', async (_, dirPath: string): Promise<DirEntry[]> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: DirEntry[] = entries
    .filter((e) => !e.name.startsWith('.') || ['.env.example', '.gitignore'].includes(e.name))
    .map((e) => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  return result;
});

ipcMain.handle('fs:readFile', async (_, filePath: string): Promise<string> => {
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, contents: string): Promise<void> => {
  await fs.writeFile(filePath, contents, 'utf-8');
});

ipcMain.handle('fs:createFile', async (_, filePath: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  // Throw if exists to avoid clobber
  const handle = await fs.open(filePath, 'wx');
  await handle.close();
});

ipcMain.handle('fs:createDir', async (_, dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: false });
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string): Promise<void> => {
  await fs.rename(oldPath, newPath);
});

ipcMain.handle('fs:delete', async (_, targetPath: string): Promise<void> => {
  const stat = await fs.stat(targetPath);
  if (stat.isDirectory()) {
    await fs.rm(targetPath, { recursive: true, force: true });
  } else {
    await fs.unlink(targetPath);
  }
});

ipcMain.handle('fs:stat', async (_, p: string) => {
  try {
    const s = await fs.stat(p);
    return { exists: true, isDirectory: s.isDirectory(), mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    return { exists: false, isDirectory: false, mtimeMs: 0, size: 0 };
  }
});

// ─── File watching (lightweight: per-file watch for external edits) ────────

const watchers = new Map<string, fsSync.FSWatcher>();

ipcMain.handle('fs:watchFile', (_, filePath: string) => {
  if (watchers.has(filePath)) return;
  try {
    const w = fsSync.watch(filePath, { persistent: false }, () => {
      mainWindow?.webContents.send('fs:fileChanged', filePath);
    });
    watchers.set(filePath, w);
  } catch {
    // file may not exist yet; ignore
  }
});

ipcMain.handle('fs:unwatchFile', (_, filePath: string) => {
  const w = watchers.get(filePath);
  if (w) {
    w.close();
    watchers.delete(filePath);
  }
});

// Workspace-level coarse watcher — recursively watches directory, fires generic refresh
let workspaceWatcher: fsSync.FSWatcher | null = null;
let workspaceWatchPath: string | null = null;

ipcMain.handle('fs:watchWorkspace', (_, dirPath: string) => {
  if (workspaceWatcher && workspaceWatchPath === dirPath) return;
  workspaceWatcher?.close();
  try {
    workspaceWatcher = fsSync.watch(dirPath, { recursive: true, persistent: false }, (_event, filename) => {
      if (!filename) return;
      const full = path.join(dirPath, filename.toString());
      mainWindow?.webContents.send('fs:workspaceChanged', { path: full });
    });
    workspaceWatchPath = dirPath;
  } catch (err) {
    console.error('Failed to watch workspace', err);
  }
});

// ─── PTY IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('pty:spawn', (_, opts: { id: string; shell?: string; args?: string[]; cwd?: string; env?: Record<string, string>; cols?: number; rows?: number }) => {
  const shellPath = opts.shell || defaultShell();
  return ptyManager!.spawn({
    id: opts.id,
    shell: shellPath,
    args: opts.args || [],
    cwd: opts.cwd || os.homedir(),
    env: { ...(process.env as Record<string, string>), ...(opts.env || {}), TERM: 'xterm-256color' },
    cols: opts.cols || 80,
    rows: opts.rows || 24,
  });
});

ipcMain.handle('pty:write', (_, id: string, data: string) => {
  ptyManager!.write(id, data);
});

ipcMain.handle('pty:resize', (_, id: string, cols: number, rows: number) => {
  ptyManager!.resize(id, cols, rows);
});

ipcMain.handle('pty:kill', (_, id: string) => {
  ptyManager!.kill(id);
});

function defaultShell(): string {
  if (process.platform === 'win32') return process.env['COMSPEC'] || 'powershell.exe';
  return process.env['SHELL'] || '/bin/bash';
}

// ─── Misc ──────────────────────────────────────────────────────────────────

ipcMain.handle('app:openExternal', async (_, url: string) => {
  await shell.openExternal(url);
});

ipcMain.handle('app:getHomeDir', () => os.homedir());

ipcMain.handle('app:resolvePath', (_, ...parts: string[]) => path.resolve(...parts));

ipcMain.handle('app:dirname', (_, p: string) => path.dirname(p));

ipcMain.handle('app:basename', (_, p: string, ext?: string) => path.basename(p, ext));

ipcMain.handle('app:extname', (_, p: string) => path.extname(p));
