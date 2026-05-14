import { createElement, useEffect, useRef, useState, MutableRefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Pin } from 'lucide-react';
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

export default function BrowserSidebar() {
  const open = useStore((s) => s.browserSidebarOpen);
  const setOpen = useStore((s) => s.setBrowserSidebarOpen);
  const settings = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);

  const webviewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const provider = settings?.browser.provider ?? 'instagram';
  const startUrl = URLS[provider];

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

  return (
    <AnimatePresence>
      {open && settings && (
        <motion.div
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
          <div
            className="flex items-center px-2 h-10 gap-1 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span
              className="text-[11px] uppercase tracking-[0.12em] font-bold flex-1 pl-1"
              style={{ color: 'var(--text-faint)' }}
            >
              break time · {settings.browser.autoOpen ? 'auto' : 'manual'}
            </span>
            <div className="flex items-center gap-0.5 mr-1">
              {(['instagram', 'youtube'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => patchSettings({ browser: { ...settings.browser, provider: p } })}
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
              onClick={() => patchSettings({ browser: { ...settings.browser, autoOpen: !settings.browser.autoOpen } })}
              title={settings.browser.autoOpen ? 'Auto-open ON — click to pin manual' : 'Auto-open OFF — click to enable'}
              style={{
                color: settings.browser.autoOpen ? 'var(--accent)' : 'var(--text-faint)',
              }}
            >
              <Pin size={13} strokeWidth={2} fill={settings.browser.autoOpen ? 'currentColor' : 'none'} />
            </button>
            <button className="icon-btn !w-7 !h-7 !rounded-md" onClick={() => setOpen(false)} title="Close">
              <X size={14} strokeWidth={2.2} />
            </button>
          </div>

          <div className="flex-1 min-h-0" style={{ background: 'white' }}>
            <Webview
              webviewRef={webviewRef}
              src={startUrl}
              partition="persist:browse"
              userAgent={USER_AGENT}
            />
          </div>

          <div
            className="px-3 py-1.5 text-[10.5px] leading-tight shrink-0"
            style={{ background: 'var(--bg-panel)', color: 'var(--text-faint)', borderTop: '1px solid var(--border)' }}
          >
            {provider === 'instagram'
              ? 'IG may show a login wall the first time. Sign in inside this panel — cookies persist.'
              : 'YouTube Shorts. Click anywhere to start, then scroll like normal.'}
          </div>
        </motion.div>
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
  // createElement avoids JSX type conflicts; Electron upgrades the tag at runtime.
  return createElement('webview', {
    ref: webviewRef,
    src,
    partition,
    useragent: userAgent,
    allowpopups: 'true',
    style: { width: '100%', height: '100%', display: 'inline-flex' },
  });
}
