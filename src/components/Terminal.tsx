import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useStore } from '../lib/store';

export type TerminalProps = {
  id: string;
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  onData?: (chunk: string) => void;
  onExit?: (code: number) => void;
  autoRespawn?: boolean;
};

export default function TerminalView(props: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const isDark = useStore((s) => s.settings?.theme === 'warm-dark');

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      allowProposedApi: true,
      scrollback: 10000,
      theme: isDark ? darkTheme : lightTheme,
    });

    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.loadAddon(new WebLinksAddon((_, url) => window.api.app.openExternal(url)));
    xterm.open(containerRef.current);

    xtermRef.current = xterm;
    fitRef.current = fit;

    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;
    let killed = false;
    let rafId: number;

    async function spawn() {
      // fit() after one rAF so the browser has finished its flex/grid pass
      // and the container has its real pixel dimensions.
      await new Promise<void>((resolve) => {
        rafId = requestAnimationFrame(() => {
          try { fit.fit(); } catch { /* container may still be zero */ }
          resolve();
        });
      });

      const opts = propsRef.current;
      // Clamp to safe minimums — some containers start at 0 before visible
      const cols = Math.max(xterm.cols, 20);
      const rows = Math.max(xterm.rows, 5);

      await window.api.pty.spawn({
        id: opts.id,
        shell: opts.shell,
        args: opts.args,
        cwd: opts.cwd,
        env: opts.env,
        cols,
        rows,
      });

      unsubData = window.api.pty.onData(opts.id, (chunk) => {
        xterm.write(chunk);
        opts.onData?.(chunk);
      });

      unsubExit = window.api.pty.onExit(opts.id, (code) => {
        opts.onExit?.(code);
        if (!killed && opts.autoRespawn) {
          xterm.writeln('\r\n\x1b[2;3m[process exited — restarting]\x1b[0m\r\n');
          setTimeout(() => {
            unsubData?.();
            unsubExit?.();
            spawn();
          }, 300);
        }
      });
    }

    spawn();

    const dataSub = xterm.onData((d) => {
      window.api.pty.write(props.id, d);
    });

    const ro = new ResizeObserver(() => {
      if (!fitRef.current || !xtermRef.current) return;
      // Skip if container is still hidden (0 dimensions)
      const { offsetWidth, offsetHeight } = containerRef.current!;
      if (offsetWidth === 0 || offsetHeight === 0) return;
      try {
        fitRef.current.fit();
        window.api.pty.resize(props.id, xtermRef.current.cols, xtermRef.current.rows);
      } catch { /* ignore */ }
    });
    ro.observe(containerRef.current);

    return () => {
      killed = true;
      cancelAnimationFrame(rafId);
      dataSub.dispose();
      ro.disconnect();
      unsubData?.();
      unsubExit?.();
      window.api.pty.kill(props.id);
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = isDark ? darkTheme : lightTheme;
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: 'var(--terminal-bg)' }}
      onClickCapture={() => xtermRef.current?.focus()}
    />
  );
}

const lightTheme = {
  background: '#FAF3E8', foreground: '#3A2E25', cursor: '#A998C2',
  cursorAccent: '#FAF3E8', selectionBackground: '#D9CFE8',
  black: '#5E5048', red: '#C97A74', green: '#5E7858', yellow: '#A88B68',
  blue: '#7B6798', magenta: '#A998C2', cyan: '#5E867A', white: '#6B5640',
  brightBlack: '#9D8676', brightRed: '#E29B96', brightGreen: '#8FA889',
  brightYellow: '#C19A6F', brightBlue: '#A998C2', brightMagenta: '#C7B6E0',
  brightCyan: '#8FB0A6', brightWhite: '#3A2E25',
};

const darkTheme = {
  background: '#221C18', foreground: '#EDDFC8', cursor: '#C7B6E0',
  cursorAccent: '#221C18', selectionBackground: '#3F3346',
  black: '#2A2320', red: '#E29B96', green: '#A8C29F', yellow: '#DCC0A2',
  blue: '#A998C2', magenta: '#C7B6E0', cyan: '#9DBFB6', white: '#EDDFC8',
  brightBlack: '#5E5048', brightRed: '#E8B5AE', brightGreen: '#B8D2AD',
  brightYellow: '#E6CFB4', brightBlue: '#C7B6E0', brightMagenta: '#D9CFE8',
  brightCyan: '#B0CEC4', brightWhite: '#FAF3E8',
};
