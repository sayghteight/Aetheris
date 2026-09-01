import React, { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { useNavigationStore } from './store/navigationStore';
import { useSettingsStore } from './store/settingsStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useI18n } from './i18n';
import { ProjectSetup } from './features/project/ProjectSetup';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ManuscriptView } from './features/manuscript/ManuscriptView';
import { ProjectSettings } from './features/project/ProjectSettings';
import { UpdatePanel } from './features/project/UpdatePanel';
import { ChangelogPanel } from './features/project/ChangelogPanel';
import { UniversePanel } from './features/universe/UniversePanel';
import { WordImportPanel } from './features/import/WordImportPanel';
import { ExportPanel } from './features/export/ExportPanel';
import { TimelinePanel } from './features/project/TimelinePanel';
import { CalendarsPanel } from './features/project/CalendarsPanel';
import { UpdateDialog } from './components/UpdateDialog';

const App: React.FC = () => {
  const { isOpen } = useProjectStore();
  const { activeView } = useNavigationStore();
  const { settings, loadSettings, isLoaded } = useSettingsStore();
  const { language, setLanguage } = useI18n();
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);

  // Sync i18n language with project settings when settings load
  useEffect(() => {
    if (isLoaded && settings.language && settings.language !== language) {
      setLanguage(settings.language);
    }
  }, [isLoaded, settings.language, language, setLanguage]);

  useEffect(() => {
    if (isOpen && !isLoaded) {
      loadSettings();
    }
  }, [isOpen, isLoaded, loadSettings]);

  // Apply theme to document - use dark class for dark themes, data-theme for light
  useEffect(() => {
    const theme = settings.theme;
    if (theme === 'light') {
      document.documentElement.removeAttribute('class');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme]);

  // Load workspace state when project opens
  const { loadWorkspaceState } = useWorkspaceStore();
  useEffect(() => {
    if (isOpen) {
      loadWorkspaceState();
    }
  }, [isOpen, loadWorkspaceState]);

  if (!isOpen) {
    return <ProjectSetup />;
  }

  // Theme-specific gradient overlays (only for dark themes)
  const themeOverlayClass = settings.theme === 'light'
    ? 'bg-[var(--color-bg-primary)]'
    : settings.theme === 'aurora'
      ? 'bg-gradient-to-b from-amber-500/5 via-[var(--color-bg-primary)] to-[var(--color-bg-primary)]'
      : settings.theme === 'noir'
        ? 'bg-gradient-to-b from-slate-900 via-[var(--color-bg-primary)] to-black'
        : 'bg-gradient-to-b from-amber-900/10 via-[var(--color-bg-primary)] to-[var(--color-bg-primary)]';

  const appShellClass = settings.focus_mode === 'focus'
    ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
    : settings.focus_mode === 'distraction-free'
      ? 'bg-black text-slate-100'
      : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]';

  // Contenido principal de la vista activa
  const renderMainView = () => {
    switch (activeView) {
      case 'manuscript':
        return <ManuscriptView onStatsUpdate={(w, r) => { setWordCount(w); setReadTime(r); }} />;
      case 'universe':
        return <UniversePanel />;
      case 'settings':
        return <ProjectSettings />;
      case 'versioning':
        return <ChangelogPanel />;
      case 'about':
        return <UpdatePanel />;
      case 'timeline':
        return <TimelinePanel />;
      case 'calendars':
        return <CalendarsPanel />;
      case 'import':
        return <WordImportPanel />;
      case 'export':
        return <ExportPanel />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Vista "{activeView}" en desarrollo...
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen ${appShellClass}`}>
      <div className={`absolute inset-0 pointer-events-none ${themeOverlayClass}`} />
      <div className="relative z-10 h-screen">
        <WorkspaceLayout wordCount={wordCount} readTime={readTime}>
          {renderMainView()}
        </WorkspaceLayout>
        <UpdateDialog />
      </div>
    </div>
  );
};

export default App;
