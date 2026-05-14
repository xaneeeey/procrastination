import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Editor, { loader, Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { X, Play, Save, FileText, Globe } from 'lucide-react';
import { useStore } from '../lib/store';
import { languageForFile } from '../lib/language-map';
import { expandCommand, extensionOf } from '../lib/run-command';

// Tell Monaco to use bundled core (no CDN). Vite + @monaco-editor/react handles it
// out of the box, but we also register our themes here.
loader.config({ monaco });

const COZY_LIGHT: monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9D8676', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'A998C2', fontStyle: 'bold' },
    { token: 'string', foreground: '8FA889' },
    { token: 'number', foreground: 'A88B68' },
    { token: 'type', foreground: 'A88B68' },
    { token: 'identifier', foreground: '3A2E25' },
    { token: 'tag', foreground: 'A998C2' },
    { token: 'attribute.name', foreground: 'E29B96' },
    { token: 'attribute.value', foreground: '8FA889' },
  ],
  colors: {
    'editor.background': '#FFFCF7',
    'editor.foreground': '#3A2E25',
    'editorLineNumber.foreground': '#C8B8A4',
    'editorLineNumber.activeForeground': '#6B5640',
    'editor.selectionBackground': '#D9CFE8',
    'editor.inactiveSelectionBackground': '#EDDFC8',
    'editor.lineHighlightBackground': '#F7EFE2',
    'editorCursor.foreground': '#A998C2',
    'editorWhitespace.foreground': '#E0D2BC',
    'editorIndentGuide.background': '#EDDFC8',
    'editorIndentGuide.activeBackground': '#D4B89A',
    'editor.findMatchBackground': '#F2C6C0',
    'editor.findMatchHighlightBackground': '#F2C6C055',
    'editorGutter.background': '#FFFCF7',
    'editorWidget.background': '#FBF7F0',
    'editorWidget.border': '#E0CCA8',
    'editorSuggestWidget.background': '#FBF7F0',
    'editorSuggestWidget.border': '#E0CCA8',
    'editorSuggestWidget.selectedBackground': '#EDDFC8',
    'scrollbarSlider.background': '#D4B89A55',
    'scrollbarSlider.hoverBackground': '#A88B6877',
  },
};

const COZY_DARK: monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '9D8D82', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C7B6E0', fontStyle: 'bold' },
    { token: 'string', foreground: 'A8C29F' },
    { token: 'number', foreground: 'DCC0A2' },
    { token: 'type', foreground: 'DCC0A2' },
    { token: 'identifier', foreground: 'EDDFC8' },
    { token: 'tag', foreground: 'C7B6E0' },
    { token: 'attribute.name', foreground: 'E8B5AE' },
    { token: 'attribute.value', foreground: 'A8C29F' },
  ],
  colors: {
    'editor.background': '#1F1A17',
    'editor.foreground': '#EDDFC8',
    'editorLineNumber.foreground': '#5E5048',
    'editorLineNumber.activeForeground': '#C8BAB0',
    'editor.selectionBackground': '#3F3346',
    'editor.lineHighlightBackground': '#26201D',
    'editorCursor.foreground': '#C7B6E0',
    'editorIndentGuide.background': '#2E2622',
    'editorIndentGuide.activeBackground': '#4B403A',
    'editorGutter.background': '#1F1A17',
    'editorWidget.background': '#2A2320',
    'editorWidget.border': '#3A302B',
    'editorSuggestWidget.background': '#2A2320',
    'editorSuggestWidget.border': '#3A302B',
    'editorSuggestWidget.selectedBackground': '#3A302B',
  },
};

function registerThemes(m: Monaco) {
  m.editor.defineTheme('cozy-light', COZY_LIGHT);
  m.editor.defineTheme('cozy-dark', COZY_DARK);
}

export default function EditorPane() {
  const openFiles = useStore((s) => s.openFiles);
  const activeFilePath = useStore((s) => s.activeFilePath);
  const setActiveFile = useStore((s) => s.setActiveFile);
  const closeFile = useStore((s) => s.closeFile);
  const updateFileContent = useStore((s) => s.updateFileContent);
  const markFileSaved = useStore((s) => s.markFileSaved);
  const flagExternalChange = useStore((s) => s.flagExternalChange);
  const clearExternalChange = useStore((s) => s.clearExternalChange);
  const settings = useStore((s) => s.settings);
  const setBottomTerminalOpen = useStore((s) => s.setBottomTerminalOpen);
  const workspacePath = useStore((s) => s.workspacePath);
  const setPreview = useStore((s) => s.setPreview);
  const previewOpen = useStore((s) => s.previewOpen);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const ignoreNextWriteEvent = useRef<Set<string>>(new Set());

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null;
  const isDark = settings?.theme === 'warm-dark';

  // Save current file
  const saveActive = useCallback(async () => {
    if (!activeFile) return;
    try {
      ignoreNextWriteEvent.current.add(activeFile.path);
      await window.api.fs.writeFile(activeFile.path, activeFile.content);
      markFileSaved(activeFile.path);
    } catch (err) {
      console.error('save failed', err);
    }
  }, [activeFile, markFileSaved]);

  // Shared handler for external file change (used by both watchers)
  const handleExternalChange = useCallback(async (path: string) => {
    if (ignoreNextWriteEvent.current.has(path)) {
      ignoreNextWriteEvent.current.delete(path);
      return;
    }
    const file = useStore.getState().openFiles.find((f) => f.path === path);
    if (!file) return;
    try {
      const newContent = await window.api.fs.readFile(path);
      if (newContent === file.content) return;
      if (file.dirty) {
        flagExternalChange(path);
      } else {
        updateFileContent(path, newContent, false);
      }
    } catch { /* file may have been deleted */ }
  }, [flagExternalChange, updateFileContent]);

  // Per-file watcher (fires on direct writes)
  useEffect(() => {
    const unsub = window.api.fs.onFileChanged(handleExternalChange);
    return unsub;
  }, [handleExternalChange]);

  // Workspace watcher as backup — catches atomic writes (write-then-rename) that
  // break the per-file inotify watcher since the inode changes
  useEffect(() => {
    const unsub = window.api.fs.onWorkspaceChanged(({ path }) => {
      handleExternalChange(path);
    });
    return unsub;
  }, [handleExternalChange]);

  // Ctrl+S / Ctrl+R hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveActive();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        runActive();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveActive, activeFile, settings]);

  async function runActive() {
    if (!activeFile || !settings) return;
    // Save first
    await saveActive();
    const ext = extensionOf(activeFile.path);
    const template = settings.runCommands[ext];
    if (!template) {
      alert(`No run command for "${ext}". Open settings (Ctrl+,) to add one.`);
      return;
    }
    const cmd = expandCommand(template, activeFile.path);
    // Open bottom terminal and dispatch the command
    setBottomTerminalOpen(true);
    // The BottomTerminal listens for this custom event
    window.dispatchEvent(new CustomEvent('run-command', { detail: { cmd, cwd: workspacePath } }));
  }

  function openPreview() {
    let url: string;
    if (activeFile?.path.endsWith('.html')) {
      url = 'file://' + activeFile.path;
    } else {
      const entered = prompt('Preview URL (e.g. http://localhost:3000):', 'http://localhost:3000');
      if (!entered) return;
      url = entered.trim();
    }
    setPreview(true, url);
  }

  async function acceptExternal(path: string) {
    const newContent = await window.api.fs.readFile(path);
    updateFileContent(path, newContent, false);
    clearExternalChange(path);
  }

  return (
    <div className="flex flex-col h-full min-w-0" style={{ background: 'var(--bg-panel-elev)' }}>
      {/* Tabs */}
      <div
        className="flex items-center gap-0.5 px-2 h-10 overflow-x-auto shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}
      >
        <AnimatePresence mode="popLayout">
          {openFiles.map((f) => {
            const isActive = f.path === activeFilePath;
            return (
              <motion.div
                key={f.path}
                layout
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                onClick={() => setActiveFile(f.path)}
                className="group flex items-center gap-2 px-3 h-8 mt-1 rounded-t-lg cursor-pointer shrink-0 text-[12.5px]"
                style={{
                  background: isActive ? 'var(--bg-panel-elev)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-dim)',
                  borderTop: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderLeft: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderRight: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderBottom: isActive ? 'none' : 'none',
                  marginBottom: isActive ? -1 : 0,
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <FileText size={12} strokeWidth={2} style={{ color: 'var(--text-faint)' }} />
                <span className="truncate max-w-[160px]">{f.name}</span>
                {f.dirty && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent-2)' }}
                    title="unsaved"
                  />
                )}
                {f.externalChangePending && (
                  <span
                    className="text-[10px] px-1 py-0.5 rounded font-bold"
                    style={{ background: 'var(--accent-warm)', color: 'var(--bg-app)' }}
                    title="changed on disk"
                  >
                    !
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (f.dirty && !confirm(`Discard unsaved changes to ${f.name}?`)) return;
                    window.api.fs.unwatchFile(f.path);
                    closeFile(f.path);
                  }}
                  className="ml-1 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-faint)' }}
                >
                  <X size={11} strokeWidth={2.4} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div className="flex-1" />
        {activeFile && (
          <div className="flex items-center gap-1 pr-1 shrink-0">
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              onClick={openPreview}
              className={`pill-btn ${previewOpen ? 'active' : ''}`}
              title="Open preview panel"
            >
              <Globe size={13} strokeWidth={2} /> preview
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              onClick={saveActive}
              className="pill-btn"
              title="Save (Ctrl+S)"
              disabled={!activeFile.dirty}
              style={{ opacity: activeFile.dirty ? 1 : 0.5 }}
            >
              <Save size={13} strokeWidth={2} /> save
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              onClick={runActive}
              className="pill-btn"
              title="Run (Ctrl+Enter)"
              style={{
                background: 'color-mix(in srgb, var(--accent-3) 30%, var(--bg-panel-elev))',
                color: 'var(--text)',
                borderColor: 'color-mix(in srgb, var(--accent-3) 55%, var(--border))',
              }}
            >
              <Play size={13} strokeWidth={2.4} fill="currentColor" /> run
            </motion.button>
          </div>
        )}
      </div>

      {/* External change banner */}
      {activeFile?.externalChangePending && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 px-4 py-2 text-[12px]"
          style={{
            background: 'color-mix(in srgb, var(--accent-warm) 22%, var(--bg-panel))',
            color: 'var(--text)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>This file was changed on disk while you had unsaved edits.</span>
          <button
            className="pill-btn"
            onClick={() => acceptExternal(activeFile.path)}
            style={{ padding: '0.25rem 0.7rem' }}
          >
            reload from disk
          </button>
          <button
            className="pill-btn"
            onClick={() => clearExternalChange(activeFile.path)}
            style={{ padding: '0.25rem 0.7rem' }}
          >
            keep mine
          </button>
        </motion.div>
      )}

      {/* Editor body */}
      <div className="flex-1 min-h-0">
        {activeFile ? (
          <Editor
            key={activeFile.path}
            theme={isDark ? 'cozy-dark' : 'cozy-light'}
            beforeMount={registerThemes}
            language={languageForFile(activeFile.path)}
            value={activeFile.content}
            path={activeFile.path}
            onMount={(ed) => {
              editorRef.current = ed;
            }}
            onChange={(value) => {
              if (value === undefined) return;
              const current = useStore.getState().openFiles.find((f) => f.path === activeFile.path);
              if (!current) return;
              if (value === current.content) return;
              updateFileContent(activeFile.path, value, true);
            }}
            options={{
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 13.5,
              fontLigatures: true,
              lineHeight: 1.65,
              minimap: { enabled: false },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 14, bottom: 14 },
              roundedSelection: true,
              renderLineHighlight: 'all',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              renderWhitespace: 'selection',
              guides: { indentation: true, bracketPairs: true },
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
            }}
          />
        ) : (
          <EmptyEditor />
        )}
      </div>
    </div>
  );
}

function EmptyEditor() {
  return (
    <div className="h-full flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="text-center"
        style={{ color: 'var(--text-faint)' }}
      >
        <div className="text-[14px] font-medium mb-1">no file open</div>
        <div className="text-[12px]">pick something from the tree on the left</div>
      </motion.div>
    </div>
  );
}
