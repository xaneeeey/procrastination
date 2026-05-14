import { useEffect } from 'react';
import { useStore } from './lib/store';
import Layout from './components/Layout';
import SettingsModal from './components/SettingsModal';
import WelcomeScreen from './components/WelcomeScreen';

export default function App() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const workspacePath = useStore((s) => s.workspacePath);
  const toggleBottomTerminal = useStore((s) => s.toggleBottomTerminal);
  const setSettingsModalOpen = useStore((s) => s.setSettingsModalOpen);

  // Boot: load settings
  useEffect(() => {
    window.api.settings.get().then(setSettings);
  }, [setSettings]);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings?.theme === 'warm-dark') {
      root.classList.add('theme-dark');
    } else {
      root.classList.remove('theme-dark');
    }
  }, [settings?.theme]);

  // Global hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+`  (Backquote)
      if (e.ctrlKey && (e.code === 'Backquote' || e.key === '`')) {
        e.preventDefault();
        toggleBottomTerminal();
        return;
      }
      // Ctrl+,  open settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setSettingsModalOpen(true);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleBottomTerminal, setSettingsModalOpen]);

  if (!settings) {
    return (
      <div className="h-full w-full flex items-center justify-center text-[var(--text-faint)] text-sm">
        loading…
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--bg-app)' }}>
      {workspacePath ? <Layout /> : <WelcomeScreen />}
      <SettingsModal />
    </div>
  );
}
