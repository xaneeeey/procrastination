import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Trash2, Coffee } from 'lucide-react';
import { useStore } from '../lib/store';

type RunRow = { ext: string; cmd: string };

function rowsFromMap(map: Record<string, string>): RunRow[] {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, cmd]) => ({ ext, cmd }));
}

function mapFromRows(rows: RunRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const ext = r.ext.trim().toLowerCase();
    if (!ext) continue;
    const normalized = ext.startsWith('.') ? ext : `.${ext}`;
    if (r.cmd.trim()) out[normalized] = r.cmd.trim();
  }
  return out;
}

export default function SettingsModal() {
  const open = useStore((s) => s.settingsModalOpen);
  const setOpen = useStore((s) => s.setSettingsModalOpen);
  const settings = useStore((s) => s.settings);
  const patchSettings = useStore((s) => s.patchSettings);

  const [rows, setRows] = useState<RunRow[]>([]);

  useEffect(() => {
    if (open && settings) {
      setRows(rowsFromMap(settings.runCommands));
    }
  }, [open, settings]);

  if (!settings) return null;

  async function save() {
    await patchSettings({ runCommands: mapFromRows(rows) });
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(30, 22, 16, 0.4)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
          >
            <div
              className="glass-strong rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col pointer-events-auto"
              style={{ background: 'var(--bg-panel)' }}
            >
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Coffee size={16} strokeWidth={2} style={{ color: 'var(--text-dim)' }} />
                  <h2 className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>
                    settings
                  </h2>
                </div>
                <button className="icon-btn" onClick={() => setOpen(false)}>
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
                <section>
                  <SectionHeader
                    title="appearance"
                    description="warm light or warm dark — never blinding"
                  />
                  <div className="flex gap-2">
                    {(['warm-light', 'warm-dark'] as const).map((t) => (
                      <motion.button
                        key={t}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => patchSettings({ theme: t })}
                        className={`pill-btn ${settings.theme === t ? 'active' : ''}`}
                      >
                        {t === 'warm-light' ? '☀️ warm light' : '🌙 warm dark'}
                      </motion.button>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    title="break time"
                    description="what plays in the sidebar while the AI cooks"
                  />
                  <div className="flex gap-2 mb-3">
                    {(['instagram', 'youtube'] as const).map((p) => (
                      <motion.button
                        key={p}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => patchSettings({ browser: { ...settings.browser, provider: p } })}
                        className={`pill-btn ${settings.browser.provider === p ? 'active' : ''}`}
                      >
                        {p === 'instagram' ? '📸 instagram reels' : '📺 youtube shorts'}
                      </motion.button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {(['off', 'monitored', 'full'] as const).map((m) => (
                      <motion.button
                        key={m}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => patchSettings({ browser: { ...settings.browser, mode: m } })}
                        className={`pill-btn ${settings.browser.mode === m ? 'active' : ''}`}
                      >
                        {m === 'off' && '🚫 off'}
                        {m === 'monitored' && '👁 monitored'}
                        {m === 'full' && '🎬 full'}
                      </motion.button>
                    ))}
                  </div>
                  <div className="text-[11.5px] mt-2" style={{ color: 'var(--text-faint)' }}>
                    {settings.browser.mode === 'off' && 'Browser never auto-opens. Use the break button manually.'}
                    {settings.browser.mode === 'monitored' && 'Browser opens beside the AI panel while it codes, closes when idle.'}
                    {settings.browser.mode === 'full' && 'Browser takes over the full window while AI codes. AI panel returns when idle.'}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    title="AI permissions"
                    description="bypass = skip per-action confirmations (only in sandboxed dirs!)"
                  />
                  <div className="space-y-2">
                    {(['claude', 'codex'] as const).map((k) => (
                      <div
                        key={k}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'var(--bg-panel-elev)', border: '1px solid var(--border)' }}
                      >
                        <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--text)' }}>
                          {k === 'claude' ? 'claude code' : 'codex'}
                        </span>
                        <label className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-dim)' }}>
                          <input
                            type="checkbox"
                            checked={settings.ai[k].bypassPermissions}
                            onChange={(e) =>
                              patchSettings({
                                ai: { ...settings.ai, [k]: { bypassPermissions: e.target.checked } },
                              })
                            }
                          />
                          bypass permissions
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionHeader
                    title="run commands"
                    description={'per-extension commands. tokens: $file $fileBase $fileName $ext $dir'}
                  />
                  <div className="space-y-1.5">
                    {rows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          className="input-cozy w-24 font-mono text-[12.5px]"
                          value={row.ext}
                          placeholder=".cpp"
                          onChange={(e) => {
                            const next = [...rows];
                            next[i] = { ...row, ext: e.target.value };
                            setRows(next);
                          }}
                        />
                        <input
                          className="input-cozy flex-1 font-mono text-[12.5px]"
                          value={row.cmd}
                          placeholder={`gcc -o "$dir/$fileBase" "$file" && "$dir/$fileBase"`}
                          onChange={(e) => {
                            const next = [...rows];
                            next[i] = { ...row, cmd: e.target.value };
                            setRows(next);
                          }}
                        />
                        <button
                          className="icon-btn"
                          onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                          title="Remove"
                          style={{ color: 'var(--accent-2)' }}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setRows([...rows, { ext: '', cmd: '' }])}
                      className="pill-btn"
                      style={{ marginTop: 6 }}
                    >
                      <Plus size={13} strokeWidth={2.4} /> add command
                    </motion.button>
                  </div>
                </section>
              </div>

              <div
                className="flex items-center justify-end gap-2 px-6 py-3 shrink-0"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <button className="pill-btn" onClick={() => setOpen(false)}>
                  cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={save}
                  className="pill-btn"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 30%, var(--bg-panel-elev))',
                    color: 'var(--text)',
                    borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--border))',
                  }}
                >
                  save
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-[0.13em] font-bold mb-0.5" style={{ color: 'var(--text-dim)' }}>
        {title}
      </div>
      <div className="text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
        {description}
      </div>
    </div>
  );
}
