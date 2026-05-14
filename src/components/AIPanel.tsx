import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, RefreshCw, Sparkles, Globe } from 'lucide-react';
import { useStore } from '../lib/store';
import TerminalView from './Terminal';

type AiKind = 'claude' | 'codex';

const AI_LABEL: Record<AiKind, string> = {
  claude: 'claude',
  codex: 'codex',
};

const AI_BIN: Record<AiKind, string> = {
  claude: 'claude',
  codex: 'codex',
};

function bypassFlag(kind: AiKind): string[] {
  if (kind === 'claude') return ['--dangerously-skip-permissions'];
  if (kind === 'codex') return ['--dangerously-bypass-approvals-and-sandbox'];
  return [];
}

// Strip ANSI escape sequences so we only count real text content
const ANSI_STRIP = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b./g;

// Burst-based activity tracker — module-level to survive React re-renders.
//
// Open logic:  accumulate non-ws chars in a burst window; open once 250+ chars land.
//              Shell PS1 prompts (~20 non-ws) never reach the threshold on their own.
//
// Close logic: separately track the last time a LARGE chunk (50+ non-ws chars)
//              arrived. Shell prompts are small and won't reset this timer.
//              After MIN_OPEN_MS has elapsed AND IDLE_CLOSE_MS has passed since the
//              last large chunk, the browser auto-closes.
type WorkingTracker = {
  startedAt: number;         // when this PTY was spawned (for startup grace)
  lastDataAt: number;        // any data after grace (for burst decay)
  lastLargeDataAt: number;   // large-chunk timestamp (for auto-close idle check)
  accumulated: number;       // burst char accumulator
  browserOpened: boolean;    // true once this tracker triggered an open
};

const STARTUP_GRACE_MS = 8_000;   // skip shell init / AI banner noise
const BURST_THRESHOLD  = 250;     // non-ws chars needed to open browser
const BURST_DECAY_MS   = 12_000;  // reset accumulator after this much idle
const LARGE_CHUNK_MIN  = 50;      // non-ws chars = "significant AI output"
const IDLE_CLOSE_MS    = 30_000;  // close after 30s with no significant output
const MIN_OPEN_MS      = 20_000;  // keep browser open at least 20s (no flicker)

// Module-level timestamp: set when browser auto-opens, cleared when it closes.
// 0 = browser was manually opened (or never auto-opened) → interval won't close it.
let browserAutoOpenedAt = 0;

const trackers: Record<AiKind, WorkingTracker> = {
  claude: { startedAt: Date.now(), lastDataAt: 0, lastLargeDataAt: 0, accumulated: 0, browserOpened: false },
  codex:  { startedAt: Date.now(), lastDataAt: 0, lastLargeDataAt: 0, accumulated: 0, browserOpened: false },
};

export default function AIPanel() {
  const open          = useStore((s) => s.aiPanelOpen);
  const activeAi      = useStore((s) => s.activeAi);
  const setActiveAi   = useStore((s) => s.setActiveAi);
  const settings      = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);
  const workspacePath = useStore((s) => s.workspacePath);
  const browserOpen   = useStore((s) => s.browserSidebarOpen);
  const setBrowser    = useStore((s) => s.setBrowserSidebarOpen);

  const [nonces, setNonces] = useState<Record<AiKind, number>>({ claude: 0, codex: 0 });

  function onAiData(kind: AiKind, chunk: string) {
    if (!settings?.browser.autoOpen) return;

    const tracker = trackers[kind];
    const now = Date.now();

    if (now - tracker.startedAt < STARTUP_GRACE_MS) return;

    // Decay burst if there's been a long pause (user is idle, not AI working)
    if (tracker.lastDataAt > 0 && now - tracker.lastDataAt > BURST_DECAY_MS) {
      tracker.accumulated = 0;
      tracker.browserOpened = false;
    }
    tracker.lastDataAt = now;

    // Count non-whitespace chars after stripping control sequences
    const nonWs = chunk.replace(ANSI_STRIP, '').replace(/\s/g, '').length;
    tracker.accumulated += nonWs;

    // Open browser once burst crosses threshold — never auto-close
    if (!tracker.browserOpened && tracker.accumulated >= BURST_THRESHOLD) {
      tracker.browserOpened = true;
      setBrowser(true);
    }
  }

  // Reset tracker when PTY exits (new process starts fresh)
  function resetTracker(kind: AiKind) {
    trackers[kind] = { startedAt: Date.now(), lastDataAt: 0, accumulated: 0, browserOpened: false };
  }

  // Reset trackers on unmount so stale startedAt doesn't bypass grace period on remount
  useEffect(() => {
    return () => {
      for (const k of Object.keys(trackers) as AiKind[]) {
        trackers[k] = { startedAt: Date.now(), lastDataAt: 0, accumulated: 0, browserOpened: false };
      }
    };
  }, []);

  function toggleBypass(kind: AiKind) {
    if (!settings) return;
    const current = settings.ai[kind].bypassPermissions;
    const confirmed = !current
      ? confirm(
          `Enable "bypass permissions" for ${AI_LABEL[kind]}?\n\n` +
          `This skips per-action confirmation prompts.\n\n` +
          `Only enable in environments you trust.`,
        )
      : true;
    if (!confirmed) return;
    patchSettings({ ai: { ...settings.ai, [kind]: { bypassPermissions: !current } } });
    restart(kind);
  }

  function restart(kind: AiKind) {
    setNonces((prev) => ({ ...prev, [kind]: prev[kind] + 1 }));
    resetTracker(kind);
    setBrowser(false);
  }

  if (!open || !settings) return null;

  return (
    <div className="flex flex-col h-full min-w-0" style={{ background: 'var(--bg-panel)' }}>
      <div
        className="flex items-center px-2 h-10 gap-1 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <Sparkles size={13} strokeWidth={2} style={{ color: 'var(--accent)' }} />
        <span className="text-[11px] uppercase tracking-[0.12em] font-bold" style={{ color: 'var(--text-faint)' }}>
          AI
        </span>
        <div className="w-px h-4 mx-2" style={{ background: 'var(--border-strong)' }} />

        {(['claude', 'codex'] as const).map((kind) => (
          <motion.button
            key={kind}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={() => setActiveAi(kind)}
            className={`pill-btn ${activeAi === kind ? 'active' : ''}`}
            style={{ padding: '0.3rem 0.7rem' }}
          >
            {AI_LABEL[kind]}
          </motion.button>
        ))}

        <div className="flex-1" />

        {/* Manual browser toggle */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setBrowser(!browserOpen)}
          className={`pill-btn ${browserOpen ? 'active' : ''}`}
          title={browserOpen ? 'Close break sidebar' : 'Open break sidebar'}
          style={{ padding: '0.3rem 0.7rem' }}
        >
          <Globe size={12} strokeWidth={2} />
          break
        </motion.button>

        <button
          onClick={() => toggleBypass(activeAi)}
          className="pill-btn"
          title={settings.ai[activeAi].bypassPermissions ? 'Bypass ON' : 'Enable bypass'}
          style={{
            background: settings.ai[activeAi].bypassPermissions
              ? 'color-mix(in srgb, var(--accent-2) 30%, var(--bg-panel-elev))' : undefined,
            borderColor: settings.ai[activeAi].bypassPermissions
              ? 'color-mix(in srgb, var(--accent-2) 55%, var(--border))' : undefined,
          }}
        >
          {settings.ai[activeAi].bypassPermissions
            ? <ShieldAlert size={12} strokeWidth={2.2} />
            : <Shield size={12} strokeWidth={2.2} />}
          bypass
        </button>

        <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={() => restart(activeAi)} title="Restart">
          <RefreshCw size={13} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {(['claude', 'codex'] as const).map((kind) => {
          const isActive = activeAi === kind;
          return (
            <div
              key={kind}
              className="absolute inset-0"
              style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', zIndex: isActive ? 1 : 0 }}
            >
              <AiTerminal
                kind={kind}
                nonce={nonces[kind]}
                bypass={settings.ai[kind].bypassPermissions}
                cwd={workspacePath || undefined}
                onData={(chunk) => onAiData(kind, chunk)}
                onExit={() => resetTracker(kind)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AiTerminal({
  kind, nonce, bypass, cwd, onData, onExit,
}: {
  kind: AiKind;
  nonce: number;
  bypass: boolean;
  cwd?: string;
  onData?: (c: string) => void;
  onExit?: (code: number) => void;
}) {
  const isWin = window.api.app.platform === 'win32';
  const flags = bypass ? bypassFlag(kind).join(' ') : '';
  const bin   = AI_BIN[kind];
  const cmd   = `${bin}${flags ? ' ' + flags : ''}; echo; echo "[${AI_LABEL[kind]} exited — press enter]"; read; exec bash -l`;

  const shellArgs = isWin
    ? ['-NoLogo', '-Command', cmd]
    : ['-lc', cmd];

  return (
    <TerminalView
      id={`ai-${kind}-${nonce}`}
      shell={isWin ? 'powershell.exe' : '/bin/bash'}
      args={shellArgs}
      cwd={cwd}
      onData={onData}
      onExit={onExit}
    />
  );
}
