import { useEffect, useState, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, Folder, FolderOpen, File as FileIcon, Trash2, RefreshCw } from 'lucide-react';
import { useStore } from '../lib/store';
import type { DirEntry } from '../types';

type NodeProps = {
  entry: DirEntry;
  depth: number;
  onRefreshParent: () => void;
  refreshGen: number;
};

function FileNode({ entry, depth, onRefreshParent, refreshGen }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [contextOpen, setContextOpen] = useState<{ x: number; y: number } | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const activeFilePath = useStore((s) => s.activeFilePath);
  const openFile = useStore((s) => s.openFile);

  const loadChildren = useCallback(async () => {
    if (!entry.isDirectory) return;
    const result = await window.api.fs.listDir(entry.path);
    setChildren(result);
  }, [entry.isDirectory, entry.path]);

  useEffect(() => {
    if (expanded && children === null) loadChildren();
  }, [expanded, children, loadChildren]);

  // Re-fetch children when workspace changes (AI may have created/deleted files)
  useEffect(() => {
    if (expanded && children !== null) loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshGen]);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  async function onClick() {
    if (entry.isDirectory) {
      setExpanded((v) => !v);
    } else {
      try {
        const content = await window.api.fs.readFile(entry.path);
        openFile(entry.path, content);
        await window.api.fs.watchFile(entry.path);
      } catch (err) {
        console.error('Failed to open file', err);
      }
    }
  }

  async function commitCreate() {
    if (!newName.trim()) {
      setCreating(null);
      setNewName('');
      return;
    }
    const target = `${entry.path}/${newName.trim()}`;
    try {
      if (creating === 'folder') {
        await window.api.fs.createDir(target);
      } else {
        await window.api.fs.createFile(target);
      }
      setNewName('');
      setCreating(null);
      setExpanded(true);
      await loadChildren();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Couldn't create: ${msg}`);
      setCreating(null);
      setNewName('');
    }
  }

  async function onDelete() {
    setContextOpen(null);
    const ok = confirm(`Delete ${entry.name}? This cannot be undone.`);
    if (!ok) return;
    try {
      await window.api.fs.delete(entry.path);
      onRefreshParent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Couldn't delete: ${msg}`);
    }
  }

  const isActive = !entry.isDirectory && activeFilePath === entry.path;

  return (
    <>
      <motion.div
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextOpen({ x: e.clientX, y: e.clientY });
        }}
        className={`group flex items-center gap-1.5 py-1 pr-2 cursor-pointer rounded-md select-none`}
        style={{
          paddingLeft: 8 + depth * 14,
          background: isActive ? 'var(--bg-active)' : 'transparent',
          color: isActive ? 'var(--text)' : 'var(--text-dim)',
        }}
      >
        {entry.isDirectory ? (
          <>
            <span style={{ color: 'var(--text-faint)' }} className="shrink-0">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <span style={{ color: 'var(--accent-warm)' }} className="shrink-0">
              {expanded ? <FolderOpen size={14} strokeWidth={1.8} /> : <Folder size={14} strokeWidth={1.8} />}
            </span>
          </>
        ) : (
          <>
            <span className="w-[13px] shrink-0" />
            <span style={{ color: 'var(--text-faint)' }} className="shrink-0">
              <FileIcon size={13} strokeWidth={1.8} />
            </span>
          </>
        )}
        <span className="text-[13px] truncate flex-1">{entry.name}</span>
        {entry.isDirectory && (
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            <button
              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setCreating('file');
              }}
              title="New file"
              style={{ color: 'var(--text-faint)' }}
            >
              <FilePlus size={12} strokeWidth={2} />
            </button>
            <button
              className="w-5 h-5 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setCreating('folder');
              }}
              title="New folder"
              style={{ color: 'var(--text-faint)' }}
            >
              <FolderPlus size={12} strokeWidth={2} />
            </button>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {expanded && entry.isDirectory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {creating && (
              <div
                className="flex items-center gap-1.5 py-1 pr-2"
                style={{ paddingLeft: 8 + (depth + 1) * 14 }}
              >
                <span className="w-[13px]" />
                <span style={{ color: creating === 'folder' ? 'var(--accent-warm)' : 'var(--text-faint)' }}>
                  {creating === 'folder' ? <Folder size={14} strokeWidth={1.8} /> : <FileIcon size={13} strokeWidth={1.8} />}
                </span>
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={commitCreate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCreate();
                    if (e.key === 'Escape') {
                      setCreating(null);
                      setNewName('');
                    }
                  }}
                  className="flex-1 bg-transparent text-[13px] outline-none border-b"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
                  placeholder={creating === 'folder' ? 'folder name' : 'file name'}
                />
              </div>
            )}
            {children?.map((child) => (
              <FileNode
                key={child.path}
                entry={child}
                depth={depth + 1}
                onRefreshParent={loadChildren}
                refreshGen={refreshGen}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {contextOpen && (
        <ContextMenu
          x={contextOpen.x}
          y={contextOpen.y}
          onClose={() => setContextOpen(null)}
          items={[
            ...(entry.isDirectory
              ? [
                  { label: 'New file', icon: <FilePlus size={13} />, onClick: () => { setExpanded(true); setCreating('file'); } },
                  { label: 'New folder', icon: <FolderPlus size={13} />, onClick: () => { setExpanded(true); setCreating('folder'); } },
                ]
              : []),
            { label: 'Delete', icon: <Trash2 size={13} />, onClick: onDelete, danger: true },
          ]}
        />
      )}
    </>
  );
}

type ContextItem = { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean };

function ContextMenu({ x, y, onClose, items }: { x: number; y: number; onClose: () => void; items: ContextItem[] }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      className="fixed z-50 glass-strong rounded-xl py-1.5 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => { it.onClick(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: it.danger ? 'var(--accent-2)' : 'var(--text)' }}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </motion.div>
  );
}

export default function Explorer() {
  const workspacePath = useStore((s) => s.workspacePath);
  const [rootEntries, setRootEntries] = useState<DirEntry[]>([]);
  const [creating, setCreating] = useState<null | 'file' | 'folder'>(null);
  const [newName, setNewName] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);
  const [refreshGen, setRefreshGen] = useState(0);

  const refresh = useCallback(async () => {
    if (!workspacePath) return;
    const entries = await window.api.fs.listDir(workspacePath);
    setRootEntries(entries);
    setRefreshGen((g) => g + 1);
  }, [workspacePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Watch workspace for external changes (e.g., AI creating files)
  useEffect(() => {
    if (!workspacePath) return;
    window.api.fs.watchWorkspace(workspacePath);
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const unsub = window.api.fs.onWorkspaceChanged(() => {
      // Debounce rapid events (AI may write many files quickly)
      if (scheduled) clearTimeout(scheduled);
      scheduled = setTimeout(refresh, 400);
    });
    return () => {
      unsub();
      if (scheduled) clearTimeout(scheduled);
    };
  }, [workspacePath, refresh]);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  async function commitRootCreate() {
    if (!workspacePath || !newName.trim()) {
      setCreating(null);
      setNewName('');
      return;
    }
    const target = `${workspacePath}/${newName.trim()}`;
    try {
      if (creating === 'folder') {
        await window.api.fs.createDir(target);
      } else {
        await window.api.fs.createFile(target);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Couldn't create: ${msg}`);
    }
    setCreating(null);
    setNewName('');
    await refresh();
  }

  const workspaceName = workspacePath?.split(/[\\/]/).filter(Boolean).pop() ?? '';

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-panel)' }}>
      <div
        className="flex items-center px-3 h-9 gap-1"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-[11px] uppercase tracking-[0.12em] font-bold flex-1 truncate"
          style={{ color: 'var(--text-faint)' }}
        >
          {workspaceName || 'explorer'}
        </span>
        <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={() => setCreating('file')} title="New file">
          <FilePlus size={13} strokeWidth={2} />
        </button>
        <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={() => setCreating('folder')} title="New folder">
          <FolderPlus size={13} strokeWidth={2} />
        </button>
        <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={refresh} title="Refresh">
          <RefreshCw size={13} strokeWidth={2} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {creating && (
          <div className="flex items-center gap-1.5 py-1 pr-2" style={{ paddingLeft: 8 + 14 }}>
            <span className="w-[13px]" />
            <span style={{ color: creating === 'folder' ? 'var(--accent-warm)' : 'var(--text-faint)' }}>
              {creating === 'folder' ? <Folder size={14} strokeWidth={1.8} /> : <FileIcon size={13} strokeWidth={1.8} />}
            </span>
            <input
              ref={newInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={commitRootCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRootCreate();
                if (e.key === 'Escape') {
                  setCreating(null);
                  setNewName('');
                }
              }}
              className="flex-1 bg-transparent text-[13px] outline-none border-b"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text)' }}
              placeholder={creating === 'folder' ? 'folder name' : 'file name'}
            />
          </div>
        )}
        {rootEntries.map((e) => (
          <FileNode key={e.path} entry={e} depth={0} onRefreshParent={refresh} refreshGen={refreshGen} />
        ))}
        {rootEntries.length === 0 && !creating && (
          <div className="px-4 py-6 text-[12px] text-center" style={{ color: 'var(--text-faint)' }}>
            empty folder — make something cozy
          </div>
        )}
      </div>
    </div>
  );
}
