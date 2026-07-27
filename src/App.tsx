import React, { useEffect } from 'react';
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
import { UniversePanel } from './features/project/UniversePanel';
import { WordImportPanel } from './features/import/WordImportPanel';
import { TimelinePanel } from './features/project/TimelinePanel';
import { CalendarsPanel } from './features/project/CalendarsPanel';
import { UpdateDialog } from './components/UpdateDialog';

const App: React.FC = () => {
  const { isOpen } = useProjectStore();
  const { activeView } = useNavigationStore();
  const { settings, loadSettings, isLoaded } = useSettingsStore();
  const { language, setLanguage } = useI18n();

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

  const themeClassName = settings.theme === 'aurora'
    ? 'from-emerald-500/20 via-slate-950 to-slate-950'
    : settings.theme === 'noir'
      ? 'from-slate-900 via-slate-950 to-black'
      : 'from-violet-900/20 via-slate-950 to-slate-950';

  const appShellClass = settings.focus_mode === 'focus'
    ? 'bg-slate-950 text-slate-100'
    : settings.focus_mode === 'distraction-free'
      ? 'bg-black text-slate-100'
      : 'bg-slate-950 text-slate-200';

  // Contenido principal de la vista activa
  const renderMainView = () => {
    switch (activeView) {
      case 'manuscript':
        return <ManuscriptView />;
      case 'universe':
        return <UniversePanel />;
      case 'settings':
        return <ProjectSettings />;
      case 'versioning':
        return <UpdatePanel />;
      case 'timeline':
        return <TimelinePanel />;
      case 'calendars':
        return <CalendarsPanel />;
      case 'import':
        return <WordImportPanel />;
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
      <div className={`absolute inset-0 bg-radial-at-t ${themeClassName} pointer-events-none`} />
      <div className="relative z-10 h-screen">
        <WorkspaceLayout>
          {renderMainView()}
        </WorkspaceLayout>
        <UpdateDialog />
      </div>
    </div>
  );
};

export default App;
