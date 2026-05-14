import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, RefreshCw, Sparkles, Globe } from 'lucide-react';
import { useStore } from '../lib/store';
import AiTerminal from './AiTerminal';

type AiKind = 'claude' | 'codex';

const AI_LABEL: Record<AiKind, string> = {
  claude: 'claude',
  codex: 'codex',
};

const ANSI_STRIP = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b./g;

// Output must flow continuously for this long before we treat it as real work.
// /resume and startup banners finish in < 500ms and never hit this threshold.
const SUSTAINED_MS = 3_000;
// How long after output stops before we close the browser.
const IDLE_MS = 7_000;

// ─── Module-level state (survives React re-renders) ─────────────────────────

let autoOpenedAt = 0;
let idleCloseTimer: ReturnType<typeof setTimeout> | null = null;

// How many recent fingerprints to remember. Ink CLIs (codex, claude) re-render
// their idle prompt in a small cycle of 2-4 slightly different frames. If the
// current chunk matches any of the last WINDOW recent frames, it's repetitive
// idle rendering — don't reset the idle timer.
const FP_WINDOW = 8;

type PtyTracker = {
  inputBuffer: string;
  hasSentPrompt: boolean;
  recentFps: string[];   // rolling window of recent fingerprints
  // True after any slash command until the next Enter is consumed.
  // /resume shows a numbered session list; the user types "1" and presses Enter
  // to select — that Enter looks like a real prompt but isn't. We suppress it
  // when it's digit-only (a menu selection) and clear the flag either way.
  slashInteractionActive: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  sustainedTimer: ReturnType<typeof setTimeout> | null;
};

function makeTracker(): PtyTracker {
  return { inputBuffer: '', hasSentPrompt: false, recentFps: [], slashInteractionActive: false, idleTimer: null, sustainedTimer: null };
}

function clearTracker(t: PtyTracker) {
  t.inputBuffer = '';
  t.hasSentPrompt = false;
  t.recentFps = [];
  t.slashInteractionActive = false;
  if (t.idleTimer)      { clearTimeout(t.idleTimer);      t.idleTimer = null; }
  if (t.sustainedTimer) { clearTimeout(t.sustainedTimer); t.sustainedTimer = null; }
}

const trackers: Record<AiKind, PtyTracker> = {
  claude: makeTracker(),
  codex:  makeTracker(),
};

// ─── Shared open / close helpers ────────────────────────────────────────────

function openBrowser() {
  if (autoOpenedAt !== 0) return;
  autoOpenedAt = Date.now();
  useStore.getState().setBrowserSidebarOpen(true);
}

function scheduleBrowserClose() {
  if (idleCloseTimer) clearTimeout(idleCloseTimer);
  idleCloseTimer = setTimeout(() => {
    idleCloseTimer = null;
    autoOpenedAt = 0;
    useStore.getState().setBrowserSidebarOpen(false);
  }, IDLE_MS);
}

// ─── PTY callbacks (same logic for both claude and codex) ───────────────────

function onAiData(kind: AiKind, chunk: string) {
  const mode = useStore.getState().settings?.browser.mode;
  const t = trackers[kind];
  if (mode === 'off' || !t.hasSentPrompt) return;

  const stripped = chunk.replace(ANSI_STRIP, '').replace(/\s/g, '');
  if (!stripped) return;

  const fp = stripped.slice(0, 80);
  if (t.recentFps.includes(fp)) return;
  t.recentFps = [...t.recentFps.slice(-(FP_WINDOW - 1)), fp];

  // Output flowing → reset idle timer.
  if (t.idleTimer) { clearTimeout(t.idleTimer); t.idleTimer = null; }

  // Arm sustained-output timer on the first unique byte.
  // Fires only if output keeps flowing for SUSTAINED_MS → real work → open.
  if (!t.sustainedTimer) {
    t.sustainedTimer = setTimeout(() => {
      t.sustainedTimer = null;
      openBrowser();
    }, SUSTAINED_MS);
  }

  // Schedule idle detection: output stopped → close (or cancel open).
  t.idleTimer = setTimeout(() => {
    t.idleTimer = null;
    t.hasSentPrompt = false;   // this turn is over; next slash command won't leak through
    t.recentFps = [];
    if (t.sustainedTimer) { clearTimeout(t.sustainedTimer); t.sustainedTimer = null; }
    if (autoOpenedAt > 0) scheduleBrowserClose();
  }, IDLE_MS);
}

function onAiInput(kind: AiKind, chunk: string) {
  const mode = useStore.getState().settings?.browser.mode;
  if (mode === 'off') return;

  const t = trackers[kind];
  for (const ch of chunk) {
    if (ch === '\r' || ch === '\n') {
      const line = t.inputBuffer.trim();
      t.inputBuffer = '';
      // Slash commands (/resume, /clear, /help…) and empty lines are never real prompts.
      // Also reset hasSentPrompt so prior-turn state doesn't leak into this output.
      if (!line || line.startsWith('/')) {
        t.hasSentPrompt = false;
        t.recentFps = [];
        t.slashInteractionActive = true;  // next Enter may be a menu selection
        if (t.sustainedTimer) { clearTimeout(t.sustainedTimer); t.sustainedTimer = null; }
        if (t.idleTimer)      { clearTimeout(t.idleTimer);      t.idleTimer = null; }
        continue;
      }

      // If a slash command just ran (e.g. /resume showed a session list) and the user
      // typed a digit-only response to pick from the menu, swallow it — it's not a
      // real coding prompt and the history dump that follows must not open the browser.
      if (t.slashInteractionActive) {
        t.slashInteractionActive = false;
        if (/^\d+$/.test(line)) continue;
      }

      t.hasSentPrompt = true;
      t.recentFps = [];
      if (t.sustainedTimer) { clearTimeout(t.sustainedTimer); t.sustainedTimer = null; }
      if (t.idleTimer)      { clearTimeout(t.idleTimer);      t.idleTimer = null; }
    } else if (ch === '\x7f' || ch === '\b') {
      t.inputBuffer = t.inputBuffer.slice(0, -1);
    } else if (ch >= ' ') {
      t.inputBuffer += ch;
    }
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

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

  // Detect manual close.
  useEffect(() => {
    if (!browserOpen && autoOpenedAt > 0) {
      autoOpenedAt = 0;
      if (idleCloseTimer) { clearTimeout(idleCloseTimer); idleCloseTimer = null; }
    }
  }, [browserOpen]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      autoOpenedAt = 0;
      if (idleCloseTimer) { clearTimeout(idleCloseTimer); idleCloseTimer = null; }
      clearTracker(trackers.claude);
      clearTracker(trackers.codex);
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
    autoOpenedAt = 0;
    if (idleCloseTimer) { clearTimeout(idleCloseTimer); idleCloseTimer = null; }
    clearTracker(trackers[kind]);
    setNonces((prev) => ({ ...prev, [kind]: prev[kind] + 1 }));
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
                onInput={(chunk) => onAiInput(kind, chunk)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
