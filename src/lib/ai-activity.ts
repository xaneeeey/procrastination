export type ActivityState = 'idle' | 'working';

// How long output must be silent before we consider the AI idle.
// LLM streaming can pause 2-3s between chunks naturally, so keep this high.
const IDLE_THRESHOLD_MS = 7000;

// Once the browser opens, keep it open for at least this long before closing.
// Prevents flickering when the AI pauses briefly mid-response.
const MIN_OPEN_MS = 10_000;

// Shell startup output during this window doesn't count as "working".
const STARTUP_GRACE_MS = 3500;

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

// Only patterns that are unambiguously "waiting for user input".
// Keep this list tight — false positives cause the browser to close mid-stream.
const IDLE_PATTERNS: RegExp[] = [
  /\?\s*\(y\/n\)\s*$/im,           // explicit y/n prompt
  /\?\s*\(yes\/no\)\s*$/im,        // explicit yes/no prompt
  /Press\s+\w+\s+to\s+continue/i,  // "press any key" style
  /^\s*>\s*$/m,                    // bare ">" alone on a line (shell/claude prompt)
  /❯\s*$/m,                        // zsh-style prompt at EOL
];

export class AiActivityDetector {
  private lastChunkAt = 0;
  private lastOpenedAt = 0;
  private createdAt = Date.now();
  private state: ActivityState = 'idle';
  private listeners = new Set<(s: ActivityState) => void>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tail = '';

  constructor(private opts: { idleMs?: number; startupGraceMs?: number } = {}) {
    this.start();
  }

  onChange(cb: (s: ActivityState) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  ingest(data: string): void {
    const graceMs = this.opts.startupGraceMs ?? STARTUP_GRACE_MS;
    const age = Date.now() - this.createdAt;

    const clean = data.replace(ANSI, '');
    this.tail = (this.tail + clean).slice(-3000);
    this.lastChunkAt = Date.now();

    // Ignore shell startup noise during the grace period
    if (age < graceMs) return;

    if (this.state !== 'working') {
      this.lastOpenedAt = Date.now();
      this.setState('working');
    }
  }

  reset(): void {
    this.tail = '';
    this.lastChunkAt = 0;
    this.lastOpenedAt = 0;
    this.createdAt = Date.now();
    this.setState('idle');
  }

  destroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.listeners.clear();
  }

  private start(): void {
    const idleMs = this.opts.idleMs ?? IDLE_THRESHOLD_MS;
    this.pollTimer = setInterval(() => {
      if (this.state !== 'working') return;

      const silentFor = Date.now() - this.lastChunkAt;
      const openFor = Date.now() - this.lastOpenedAt;

      // Don't close if we haven't been open long enough (prevents flicker)
      if (openFor < MIN_OPEN_MS) return;

      if (silentFor < idleMs) return;

      // Check for unambiguous prompt patterns
      const tailSlice = this.tail.slice(-600);
      const isPrompt = IDLE_PATTERNS.some((p) => p.test(tailSlice));

      if (isPrompt || silentFor > idleMs * 2) {
        this.setState('idle');
      }
    }, 500);
  }

  private setState(s: ActivityState): void {
    if (this.state === s) return;
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
