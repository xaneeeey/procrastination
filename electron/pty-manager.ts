import type { IPty } from 'node-pty';
import { createRequire } from 'node:module';
// node-pty is a native module — load via CJS require so the build doesn't try to bundle it
const require = createRequire(import.meta.url);
const pty = require('node-pty') as typeof import('node-pty');

type SpawnOpts = {
  id: string;
  shell: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
};

export type PtyManager = {
  spawn: (opts: SpawnOpts) => { id: string; pid: number };
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  killAll: () => void;
};

export function createPtyManager(
  onData: (id: string, data: string) => void,
  onExit: (id: string, code: number) => void,
): PtyManager {
  const procs = new Map<string, IPty>();

  return {
    spawn(opts) {
      // Kill any previous proc with same id
      const prev = procs.get(opts.id);
      if (prev) {
        try { prev.kill(); } catch { /* ignore */ }
        procs.delete(opts.id);
      }

      const proc = pty.spawn(opts.shell, opts.args, {
        name: 'xterm-256color',
        cols: opts.cols,
        rows: opts.rows,
        cwd: opts.cwd,
        env: opts.env,
      });

      procs.set(opts.id, proc);

      proc.onData((data: string) => onData(opts.id, data));
      proc.onExit(({ exitCode }) => {
        procs.delete(opts.id);
        onExit(opts.id, exitCode);
      });

      return { id: opts.id, pid: proc.pid };
    },
    write(id, data) {
      procs.get(id)?.write(data);
    },
    resize(id, cols, rows) {
      try {
        procs.get(id)?.resize(cols, rows);
      } catch { /* PTY may have exited */ }
    },
    kill(id) {
      const p = procs.get(id);
      if (p) {
        try { p.kill(); } catch { /* ignore */ }
        procs.delete(id);
      }
    },
    killAll() {
      for (const [id, p] of procs.entries()) {
        try { p.kill(); } catch { /* ignore */ }
        procs.delete(id);
      }
    },
  };
}
