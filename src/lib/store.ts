import { create } from 'zustand';
import type { Settings, OpenFile } from '../types';

type State = {
  settings: Settings | null;
  workspacePath: string | null;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  bottomTerminalOpen: boolean;
  aiPanelOpen: boolean;
  activeAi: 'claude' | 'codex';
  browserSidebarOpen: boolean;
  previewOpen: boolean;
  previewUrl: string;
  settingsModalOpen: boolean;

  setSettings: (s: Settings) => void;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
  setWorkspacePath: (p: string | null) => void;
  openFile: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string, markDirty: boolean) => void;
  markFileSaved: (path: string) => void;
  flagExternalChange: (path: string) => void;
  clearExternalChange: (path: string) => void;
  setBottomTerminalOpen: (v: boolean) => void;
  toggleBottomTerminal: () => void;
  setAiPanelOpen: (v: boolean) => void;
  setActiveAi: (a: 'claude' | 'codex') => void;
  setBrowserSidebarOpen: (v: boolean) => void;
  setPreview: (open: boolean, url?: string) => void;
  setSettingsModalOpen: (v: boolean) => void;
};

export const useStore = create<State>((set, get) => ({
  settings: null,
  workspacePath: null,
  openFiles: [],
  activeFilePath: null,
  bottomTerminalOpen: false,
  aiPanelOpen: true,
  activeAi: 'claude',
  browserSidebarOpen: false,
  previewOpen: false,
  previewUrl: '',
  settingsModalOpen: false,

  setSettings: (s) => set({ settings: s, workspacePath: s.workspacePath }),
  patchSettings: async (patch) => {
    const next = await window.api.settings.set(patch);
    set({ settings: next, workspacePath: next.workspacePath });
  },
  setWorkspacePath: (p) => set({ workspacePath: p }),

  openFile: (path, content) => {
    const existing = get().openFiles.find((f) => f.path === path);
    if (existing) {
      set({ activeFilePath: path });
      return;
    }
    const name = path.split(/[\\/]/).pop() || path;
    set({
      openFiles: [...get().openFiles, { path, name, content, dirty: false, externalChangePending: false }],
      activeFilePath: path,
    });
  },
  closeFile: (path) => {
    const remaining = get().openFiles.filter((f) => f.path !== path);
    const wasActive = get().activeFilePath === path;
    set({
      openFiles: remaining,
      activeFilePath: wasActive ? remaining[remaining.length - 1]?.path ?? null : get().activeFilePath,
    });
  },
  setActiveFile: (path) => set({ activeFilePath: path }),
  updateFileContent: (path, content, markDirty) => {
    set({
      openFiles: get().openFiles.map((f) =>
        f.path === path ? { ...f, content, dirty: markDirty ? true : f.dirty } : f,
      ),
    });
  },
  markFileSaved: (path) => {
    set({
      openFiles: get().openFiles.map((f) => (f.path === path ? { ...f, dirty: false } : f)),
    });
  },
  flagExternalChange: (path) => {
    set({
      openFiles: get().openFiles.map((f) => (f.path === path ? { ...f, externalChangePending: true } : f)),
    });
  },
  clearExternalChange: (path) => {
    set({
      openFiles: get().openFiles.map((f) =>
        f.path === path ? { ...f, externalChangePending: false } : f,
      ),
    });
  },

  setBottomTerminalOpen: (v) => set({ bottomTerminalOpen: v }),
  toggleBottomTerminal: () => set({ bottomTerminalOpen: !get().bottomTerminalOpen }),
  setAiPanelOpen: (v) => set({ aiPanelOpen: v }),
  setActiveAi: (a) => set({ activeAi: a }),
  setBrowserSidebarOpen: (v) => set({ browserSidebarOpen: v }),
  setPreview: (open, url) => set((s) => ({ previewOpen: open, previewUrl: url ?? s.previewUrl })),
  setSettingsModalOpen: (v) => set({ settingsModalOpen: v }),
}));
