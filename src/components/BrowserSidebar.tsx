import { createElement, useEffect, useRef, useState, MutableRefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Monitor, Maximize2, EyeOff } from 'lucide-react';
import { useStore } from '../lib/store';

const URLS = {
  instagram: 'https://www.instagram.com/reels/',
  youtube: 'https://www.youtube.com/shorts/',
};

// Desktop UA strings — necessary to dodge "use the app" mobile walls.
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Electron's <webview> element. React's built-in JSX typing is too restrictive
// for the partition/useragent/allowpopups props, so we use createElement with
// a permissive type instead of augmenting JSX.IntrinsicElements.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebView = any;

const MODE_ORDER = ['off', 'monitored', 'full'] as const;
type BrowserMode = typeof MODE_ORDER[number];

const MODE_ICONS = {
  off: EyeOff,
  monitored: Monitor,
  full: Maximize2,
};

export default function BrowserSidebar() {
  const open = useStore((s) => s.browserSidebarOpen);
  const setOpen = useStore((s) => s.setBrowserSidebarOpen);
  const settings = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);

  const webviewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const provider = settings?.browser.provider ?? 'instagram';
  const mode: BrowserMode = settings?.browser.mode ?? 'monitored';
  const startUrl = URLS[provider];
  const isFullMode = mode === 'full';

  useEffect(() => {
    if (!open) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const onNav = (e: { url: string }) => setCurrentUrl(e.url);
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [open]);

  function openExternal() {
    const url = currentUrl || startUrl;
    window.api.app.openExternal(url);
  }

  function cycleMode() {
    if (!settings) return;
    const idx = MODE_ORDER.indexOf(mode);
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    patchSettings({ browser: { ...settings.browser, mode: next } });
  }

  const ModeIcon = MODE_ICONS[mode];

  const header = (
    <div
      className="flex items-center px-2 h-10 gap-1 shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span
        className="text-[11px] uppercase tracking-[0.12em] font-bold flex-1 pl-1"
        style={{ color: 'var(--text-faint)' }}
      >
        break time · {mode}
      </span>
      <div className="flex items-center gap-0.5 mr-1">
        {(['instagram', 'youtube'] as const).map((p) => (
          <button
            key={p}
            onClick={() => settings && patchSettings({ browser: { ...settings.browser, provider: p } })}
            className="text-[11px] font-semibold px-2 py-1 rounded-md transition-all"
            style={{
              background: provider === p ? 'var(--bg-active)' : 'transparent',
              color: provider === p ? 'var(--text)' : 'var(--text-faint)',
            }}
          >
            {p === 'instagram' ? 'IG' : 'YT'}
          </button>
        ))}
      </div>
      <button
        className="icon-btn !w-7 !h-7 !rounded-md"
        onClick={() => webviewRef.current?.goBack?.()}
        title="Back"
      >
        <ArrowLeft size={13} strokeWidth={2} />
      </button>
      <button
        className="icon-btn !w-7 !h-7 !rounded-md"
        onClick={() => webviewRef.current?.goForward?.()}
        title="Forward"
      >
        <ArrowRight size={13} strokeWidth={2} />
      </button>
      <button
        className="icon-btn !w-7 !h-7 !rounded-md"
        onClick={() => webviewRef.current?.reload?.()}
        title="Reload"
      >
        <RotateCw size={13} strokeWidth={2} />
      </button>
      <button
        className="icon-btn !w-7 !h-7 !rounded-md"
        onClick={openExternal}
        title="Open in browser"
      >
        <ExternalLink size={13} strokeWidth={2} />
      </button>
      <button
        className="icon-btn !w-7 !h-7 !rounded-md"
        onClick={cycleMode}
        title={`Mode: ${mode} (click to cycle)`}
        style={{ color: mode !== 'off' ? 'var(--accent)' : 'var(--text-faint)' }}
      >
        <ModeIcon size={13} strokeWidth={2} />
      </button>
      <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={() => setOpen(false)} title="Close">
        <X size={14} strokeWidth={2.2} />
      </button>
    </div>
  );

  const footer = (
    <div
      className="px-3 py-1.5 text-[10.5px] leading-tight shrink-0"
      style={{ background: 'var(--bg-panel)', color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}
    >
      {provider === 'instagram'
        ? 'IG may show a login wall the first time. Sign in inside this panel — cookies persist.'
        : 'YouTube Shorts. Click anywhere to start, then scroll like normal.'}
    </div>
  );

  return (
    <AnimatePresence>
      {open && settings && (
        isFullMode ? (
          <motion.div
            key="browser-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex flex-col z-50"
            style={{ background: 'var(--bg-panel)' }}
          >
            {header}
            <div className="flex-1 min-h-0" style={{ background: 'white' }}>
              <Webview webviewRef={webviewRef} src={startUrl} partition="persist:browse" userAgent={USER_AGENT} />
            </div>
            {footer}
          </motion.div>
        ) : (
          <motion.div
            key="browser-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
            className="flex flex-col overflow-hidden shrink-0"
            style={{
              background: 'var(--bg-panel)',
              borderLeft: '1px solid var(--border)',
            }}
          >
            {header}
            <div className="flex-1 min-h-0" style={{ background: 'white' }}>
              <Webview webviewRef={webviewRef} src={startUrl} partition="persist:browse" userAgent={USER_AGENT} />
            </div>
            {footer}
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
}

function Webview({
  webviewRef,
  src,
  partition,
  userAgent,
}: {
  webviewRef: MutableRefObject<WebView>;
  src: string;
  partition: string;
  userAgent: string;
}) {
  return createElement('webview', {
    ref: webviewRef,
    src,
    partition,
    useragent: userAgent,
    allowpopups: 'true',
    style: { width: '100%', height: '100%', display: 'inline-flex' },
  });
}
