import { motion } from 'framer-motion';
import { Coffee, FolderOpen } from 'lucide-react';
import { useStore } from '../lib/store';

export default function WelcomeScreen() {
  const setSettings = useStore((s) => s.setSettings);

  async function pickWorkspace() {
    const next = await window.api.workspace.pick();
    if (next) {
      const s = await window.api.settings.get();
      setSettings(s);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className="glass-strong rounded-3xl px-10 py-12 max-w-md w-full text-center"
      >
        <motion.div
          animate={{ rotate: [0, -6, 6, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3 }}
          className="inline-flex w-16 h-16 items-center justify-center rounded-2xl mb-5"
          style={{ background: 'color-mix(in srgb, var(--accent-warm) 32%, var(--bg-panel-elev))' }}
        >
          <Coffee size={32} strokeWidth={1.7} style={{ color: 'var(--text)' }} />
        </motion.div>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text)' }}>
          procrastination
        </h1>
        <p className="text-sm mb-7 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          a cozy code editor that <em>lovingly distracts you</em> while the AI does the work.
        </p>
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          onClick={pickWorkspace}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm"
          style={{
            background: 'color-mix(in srgb, var(--accent) 28%, var(--bg-panel-elev))',
            color: 'var(--text)',
            border: '1px solid color-mix(in srgb, var(--accent) 50%, var(--border))',
            boxShadow: '0 4px 18px -6px color-mix(in srgb, var(--accent) 50%, transparent)',
          }}
        >
          <FolderOpen size={16} strokeWidth={2} />
          open a folder
        </motion.button>
      </motion.div>
    </div>
  );
}
