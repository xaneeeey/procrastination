import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Terminal as TermIcon, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import TerminalView from './Terminal';

type Shell = { id: string; label: string };

export default function BottomTerminal() {
  const open = useStore((s) => s.bottomTerminalOpen);
  const setOpen = useStore((s) => s.setBottomTerminalOpen);
  const workspacePath = useStore((s) => s.workspacePath);

  const [shells, setShells] = useState<Shell[]>([{ id: 'bottom-1', label: 'shell' }]);
  const [activeId, setActiveId] = useState<string>('bottom-1');
  const nextIdRef = useRef(2);

  // When a "run-command" custom event fires, focus this terminal and pipe the command
  useEffect(() => {
    function handler(ev: Event) {
      const e = ev as CustomEvent<{ cmd: string; cwd?: string | null }>;
      const { cmd } = e.detail;
      // Make sure we have a shell ready
      const targetId = shells[0]?.id ?? 'bottom-1';
      setActiveId(targetId);
      setOpen(true);
      // Slight delay so the terminal is mounted before we type
      setTimeout(() => {
        window.api.pty.write(targetId, cmd + '\r');
      }, 150);
    }
    window.addEventListener('run-command', handler as EventListener);
    return () => window.removeEventListener('run-command', handler as EventListener);
  }, [shells, setOpen]);

  function addShell() {
    const id = `bottom-${nextIdRef.current++}`;
    setShells((s) => [...s, { id, label: 'shell' }]);
    setActiveId(id);
  }

  function closeShell(id: string) {
    if (shells.length === 1) {
      setOpen(false);
      return;
    }
    window.api.pty.kill(id);
    setShells((s) => s.filter((sh) => sh.id !== id));
    if (activeId === id) setActiveId(shells[0]?.id ?? '');
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 280, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="flex flex-col overflow-hidden shrink-0"
          style={{
            background: 'var(--terminal-bg)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            className="flex items-center px-2 h-9 gap-1 shrink-0"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}
          >
            <TermIcon size={13} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
            <span className="text-[11px] uppercase tracking-[0.12em] font-bold" style={{ color: 'var(--text-faint)' }}>
              terminal
            </span>
            <div className="w-px h-4 mx-2" style={{ background: 'var(--border-strong)' }} />
            <div className="flex items-center gap-1">
              {shells.map((sh) => (
                <button
                  key={sh.id}
                  onClick={() => setActiveId(sh.id)}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
                  style={{
                    background: activeId === sh.id ? 'var(--bg-active)' : 'transparent',
                    color: activeId === sh.id ? 'var(--text)' : 'var(--text-dim)',
                  }}
                >
                  {sh.label}
                  <X
                    size={10}
                    strokeWidth={2.4}
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeShell(sh.id);
                    }}
                  />
                </button>
              ))}
              <button className="icon-btn !w-6 !h-6 !rounded-md" onClick={addShell} title="New shell">
                <Plus size={12} strokeWidth={2.4} />
              </button>
            </div>
            <div className="flex-1" />
            <button
              className="icon-btn !w-6 !h-6 !rounded-md"
              onClick={() => window.api.pty.write(activeId, 'clear\r')}
              title="Clear"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
            <button className="icon-btn !w-6 !h-6 !rounded-md" onClick={() => setOpen(false)} title="Close (Ctrl+`)">
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>

          {/* Keep all shells mounted — opacity:0 preserves layout for FitAddon */}
          <div className="flex-1 min-h-0 relative">
            {shells.map((sh) => (
              <div
                key={sh.id}
                className="absolute inset-0"
                style={{
                  opacity: sh.id === activeId ? 1 : 0,
                  pointerEvents: sh.id === activeId ? 'auto' : 'none',
                  zIndex: sh.id === activeId ? 1 : 0,
                }}
              >
                <TerminalView
                  id={sh.id}
                  cwd={workspacePath || undefined}
                  autoRespawn
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
