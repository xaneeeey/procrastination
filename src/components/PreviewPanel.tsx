import { createElement, useEffect, useRef, useState, MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, RotateCw, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useStore } from '../lib/store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebView = any;

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export default function PreviewPanel() {
  const previewOpen = useStore((s) => s.previewOpen);
  const previewUrl = useStore((s) => s.previewUrl);
  const setPreview = useStore((s) => s.setPreview);

  const webviewRef = useRef<WebView>(null);
  const [inputUrl, setInputUrl] = useState(previewUrl);
  const [currentUrl, setCurrentUrl] = useState(previewUrl);

  // Sync input when store URL changes (e.g. opening a new file)
  useEffect(() => {
    setInputUrl(previewUrl);
    setCurrentUrl(previewUrl);
  }, [previewUrl]);

  // Listen for navigation events
  useEffect(() => {
    if (!previewOpen) return;
    const wv = webviewRef.current;
    if (!wv) return;
    const onNav = (e: { url: string }) => {
      setCurrentUrl(e.url);
      setInputUrl(e.url);
    };
    wv.addEventListener('did-navigate', onNav);
    wv.addEventListener('did-navigate-in-page', onNav);
    return () => {
      wv.removeEventListener('did-navigate', onNav);
      wv.removeEventListener('did-navigate-in-page', onNav);
    };
  }, [previewOpen]);

  if (!previewOpen) return null;

  function navigate(url: string) {
    let target = url.trim();
    if (!target) return;
    if (!/^[a-z]+:\/\//i.test(target) && !target.startsWith('file://')) {
      target = 'http://' + target;
    }
    setPreview(true, target);
    setInputUrl(target);
    webviewRef.current?.loadURL?.(target);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') navigate(inputUrl);
  }

  function openExternal() {
    window.api.app.openExternal(currentUrl || previewUrl);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex flex-col h-full w-full min-w-0"
      style={{ background: 'var(--bg-panel)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-2 h-10 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
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

        {/* URL bar */}
        <input
          className="flex-1 px-3 h-7 text-[12px] rounded-md outline-none"
          style={{
            background: 'var(--bg-panel-elev)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'ui-monospace, monospace',
          }}
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          placeholder="Enter URL or file:// path…"
        />

        <button
          className="icon-btn !w-7 !h-7 !rounded-md"
          onClick={() => navigate(inputUrl)}
          title="Go"
        >
          <RefreshCw size={13} strokeWidth={2} />
        </button>
        <button
          className="icon-btn !w-7 !h-7 !rounded-md"
          onClick={openExternal}
          title="Open in system browser"
        >
          <ExternalLink size={13} strokeWidth={2} />
        </button>
        <button
          className="icon-btn !w-7 !h-7 !rounded-md"
          onClick={() => setPreview(false)}
          title="Close preview"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      {/* Webview */}
      <div className="flex-1 min-h-0" style={{ background: 'white' }}>
        <PreviewWebview webviewRef={webviewRef} src={previewUrl} />
      </div>
    </motion.div>
  );
}

function PreviewWebview({
  webviewRef,
  src,
}: {
  webviewRef: MutableRefObject<WebView>;
  src: string;
}) {
  return createElement('webview', {
    ref: webviewRef,
    src,
    partition: 'persist:preview',
    useragent: USER_AGENT,
    allowpopups: 'true',
    style: { width: '100%', height: '100%', display: 'inline-flex' },
  });
}
