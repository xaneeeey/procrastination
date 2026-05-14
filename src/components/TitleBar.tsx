import { motion } from 'framer-motion';
import { FolderOpen, Settings, Sun, Moon, Sparkles, Terminal as TermIcon, Bot } from 'lucide-react';
import { useStore } from '../lib/store';

export default function TitleBar() {
  const settings = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);
  const workspacePath = useStore((s) => s.workspacePath);
  const toggleBottomTerminal = useStore((s) => s.toggleBottomTerminal);
  const aiPanelOpen = useStore((s) => s.aiPanelOpen);
  const setAiPanelOpen = useStore((s) => s.setAiPanelOpen);

  async function reopenWorkspace() {
    await window.api.workspace.pick();
    const s = await window.api.settings.get();
    useStore.getState().setSettings(s);
    // Drop currently open files since workspace changed
    useStore.setState({ openFiles: [], activeFilePath: null });
  }

  const workspaceName = workspacePath?.split(/[\\/]/).filter(Boolean).pop() ?? '';

  const isDark = settings?.theme === 'warm-dark';

  return (
    <div
      className="flex items-center px-3 h-11 gap-2"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}
    >
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'color-mix(in srgb, var(--accent-warm) 32%, var(--bg-panel-elev))' }}
      >
        <Sparkles size={14} style={{ color: 'var(--text-dim)' }} strokeWidth={2} />
      </motion.div>

      <div className="text-sm font-bold tracking-tight" style={{ color: 'var(--text)' }}>
        procrastination
      </div>

      <div className="text-xs px-2 py-0.5 rounded-md font-medium" style={{
        background: 'var(--bg-hover)',
        color: 'var(--text-dim)',
      }}>
        {workspaceName || 'no folder'}
      </div>

      <div className="flex-1" />

      <button
        className={`pill-btn ${aiPanelOpen ? 'active' : ''}`}
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        title="Toggle AI panel"
      >
        <Bot size={14} strokeWidth={2} />
        AI
      </button>
      <button className="pill-btn" onClick={toggleBottomTerminal} title="Ctrl+`">
        <TermIcon size={14} strokeWidth={2} />
        terminal
      </button>
      <button className="icon-btn" onClick={reopenWorkspace} title="Open folder">
        <FolderOpen size={16} strokeWidth={2} />
      </button>
      <button
        className="icon-btn"
        onClick={() => patchSettings({ theme: isDark ? 'warm-light' : 'warm-dark' })}
        title="Toggle theme"
      >
        {isDark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
      </button>
      <button className="icon-btn" onClick={() => setSettingsModalOpen(true)} title="Settings (Ctrl+,)">
        <Settings size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
