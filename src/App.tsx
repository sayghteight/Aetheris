import React, { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSettingsStore } from './store/settingsStore';
import { useAppSettingsStore } from './store/appSettingsStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useTabStore } from './store/tabStore';
import { useI18n } from './i18n';
import { ProjectSetup } from './features/project/ProjectSetup';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { TabBar } from './components/tab-bar';
import { TabContent } from './components/tab-bar/TabContent';
import { UpdateDialog } from './components/UpdateDialog';

const App: React.FC = () => {
  const { isOpen } = useProjectStore();
  const { settings, loadSettings, isLoaded } = useSettingsStore();
  const {
    settings: appSettings,
    loadSettings: loadAppSettings,
    isLoaded: appSettingsLoaded,
  } = useAppSettingsStore();
  const { language, setLanguage } = useI18n();
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);

  // Ajustes de la aplicacion: se cargan siempre, haya proyecto abierto o no.
  useEffect(() => {
    loadAppSettings();
  }, [loadAppSettings]);

  // El idioma es un ajuste de la aplicacion, no de la novela.
  useEffect(() => {
    if (appSettingsLoaded && appSettings.language && appSettings.language !== language) {
      setLanguage(appSettings.language);
    }
  }, [appSettingsLoaded, appSettings.language, language, setLanguage]);

  useEffect(() => {
    if (isOpen && !isLoaded) {
      loadSettings();
    }
  }, [isOpen, isLoaded, loadSettings]);

  // Apply theme to document - use dark class for dark themes, data-theme for light
  useEffect(() => {
    const theme = appSettings.theme;
    if (theme === 'light') {
      document.documentElement.removeAttribute('class');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.add('dark');
    }
  }, [appSettings.theme]);

  // Load workspace state when project opens
  const { loadWorkspaceState } = useWorkspaceStore();
  useEffect(() => {
    if (isOpen) {
      loadWorkspaceState();
    }
  }, [isOpen, loadWorkspaceState]);

  // Load tabs when project opens
  const { loadTabs, tabs } = useTabStore();
  useEffect(() => {
    if (isOpen) {
      loadTabs();
    }
  }, [isOpen, loadTabs]);

  // If no tabs are open, initialize with manuscript view
  useEffect(() => {
    if (isOpen && tabs.length === 0) {
      const { openTab } = useTabStore.getState();
      openTab({ type: 'manuscript', title: 'Manuscript' });
    }
  }, [isOpen, tabs.length]);

  if (!isOpen) {
    return <ProjectSetup />;
  }

  // Theme-specific gradient overlays (only for dark themes)
  const themeOverlayClass = appSettings.theme === 'light'
    ? 'bg-[var(--color-bg-primary)]'
    : appSettings.theme === 'aurora'
      ? 'bg-gradient-to-b from-amber-500/5 via-[var(--color-bg-primary)] to-[var(--color-bg-primary)]'
      : appSettings.theme === 'noir'
        ? 'bg-gradient-to-b from-slate-900 via-[var(--color-bg-primary)] to-black'
        : 'bg-gradient-to-b from-amber-900/10 via-[var(--color-bg-primary)] to-[var(--color-bg-primary)]';

  const appShellClass = settings.focus_mode === 'focus'
    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
    : settings.focus_mode === 'distraction-free'
      ? 'bg-black text-slate-100'
      : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]';

  return (
    <div className={`min-h-screen ${appShellClass}`}>
      <div className={`absolute inset-0 pointer-events-none ${themeOverlayClass}`} />
      <div className="relative z-10 h-screen">
        <WorkspaceLayout wordCount={wordCount} readTime={readTime}>
          <TabBar />
          <TabContent
            onStatsUpdate={(words, read) => {
              setWordCount(words);
              setReadTime(read);
            }}
          />
        </WorkspaceLayout>
        <UpdateDialog />
      </div>
    </div>
  );
};

export default App;
