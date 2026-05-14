import { useEffect, useRef, useState } from 'react';
import TitleBar from './TitleBar';
import Explorer from './Explorer';
import EditorPane from './EditorPane';
import BottomTerminal from './BottomTerminal';
import AIPanel from './AIPanel';
import BrowserSidebar from './BrowserSidebar';
import PreviewPanel from './PreviewPanel';
import { useStore } from '../lib/store';

const EXPLORER_MIN = 160;
const EXPLORER_MAX = 480;
const AI_MIN = 280;
const AI_MAX = 720;

export default function Layout() {
  const [explorerWidth, setExplorerWidth] = useState<number>(() => readNum('explorerWidth', 240));
  const [aiWidth, setAiWidth] = useState<number>(() => readNum('aiWidth', 420));
  const previewOpen = useStore((s) => s.previewOpen);

  useEffect(() => {
    saveNum('explorerWidth', explorerWidth);
  }, [explorerWidth]);
  useEffect(() => {
    saveNum('aiWidth', aiWidth);
  }, [aiWidth]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex min-h-0 min-w-0">
        {previewOpen ? (
          /* Preview mode: full left area is the preview panel */
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <PreviewPanel />
          </div>
        ) : (
          <>
            {/* Explorer */}
            <div style={{ width: explorerWidth }} className="shrink-0 h-full">
              <Explorer />
            </div>
            <Splitter
              onDrag={(dx) =>
                setExplorerWidth((w) => Math.min(EXPLORER_MAX, Math.max(EXPLORER_MIN, w + dx)))
              }
            />

            {/* Editor (flex 1) */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex-1 min-h-0">
                <EditorPane />
              </div>
              <BottomTerminal />
            </div>
          </>
        )}

        {/* AI Panel (resizable) */}
        <AiSection width={aiWidth} setWidth={setAiWidth} />

        {/* Browser sidebar — width is animated by component itself */}
        <BrowserSidebar />
      </div>
    </div>
  );
}

function AiSection({ width, setWidth }: { width: number; setWidth: (w: number | ((p: number) => number)) => void }) {
  const isOpen = useStore((s) => s.aiPanelOpen);
  if (!isOpen) return null;
  return (
    <>
      <Splitter onDrag={(dx) => setWidth((w) => Math.min(AI_MAX, Math.max(AI_MIN, w - dx)))} />
      <div style={{ width }} className="shrink-0 h-full">
        <AIPanel />
      </div>
    </>
  );
}

function Splitter({ onDrag }: { onDrag: (dx: number) => void }) {
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const dx = e.clientX - startX.current;
    onDrag(dx);
    startX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    dragging.current = false;
    startX.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    document.body.style.cursor = '';
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="w-1.5 shrink-0 cursor-col-resize group"
      style={{ background: 'transparent' }}
    >
      <div
        className="w-px h-full mx-auto transition-colors"
        style={{ background: 'var(--border)' }}
      />
    </div>
  );
}

function readNum(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function saveNum(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch { /* ignore */ }
}
