import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useProjectStore, RESTORE_REOPEN_KEY } from './store/projectStore';
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
import { CloseGuard } from './features/settings/CloseGuard';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { saveActiveScene } from './utils/sceneSaver';

const App: React.FC = () => {
  const { isOpen, openProject } = useProjectStore();
  const { settings, loadSettings, isLoaded } = useSettingsStore();
  const {
    settings: appSettings,
    loadSettings: loadAppSettings,
    isLoaded: appSettingsLoaded,
  } = useAppSettingsStore();
  const { language, setLanguage } = useI18n();
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);

  // Atajo de guardado: guarda la escena activa aunque el autoguardado este
  // desactivado en los ajustes de la aplicacion.
  useKeyboardShortcuts({
    onSave: () => {
      void saveActiveScene();
    },
  });

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

  // Tema de la interfaz. El atributo `data-theme` es lo que selecciona la
  // paleta en index.css: hay que asignarlo siempre con el nombre del tema
  // (los temas oscuros no tienen bloque propio y usan la paleta base).
  useEffect(() => {
    const theme = appSettings.theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme !== 'light');
  }, [appSettings.theme]);

  // Zoom de la interfaz y comportamiento de la ventana.
  useEffect(() => {
    if (!appSettingsLoaded) return;

    // Las llamadas a la ventana pueden lanzar si el runtime no esta disponible:
    // un fallo aqui no debe derribar la aplicacion.
    try {
      getCurrentWebview().setZoom(appSettings.interfaceZoom).catch(() => {});
      getCurrentWindow().setAlwaysOnTop(appSettings.alwaysOnTop).catch(() => {});
      getCurrentWindow().setResizable(appSettings.resizable).catch(() => {});
    } catch (error) {
      console.error(error);
    }
  }, [
    appSettingsLoaded,
    appSettings.interfaceZoom,
    appSettings.alwaysOnTop,
    appSettings.resizable,
  ]);

  // Tras restaurar un snapshot el proyecto se sustituye entero y la interfaz
  // se recarga: hay que volver a abrirlo para no dejar al usuario en la
  // biblioteca con el trabajo a medias.
  useEffect(() => {
    if (isOpen) return;
    const path = sessionStorage.getItem(RESTORE_REOPEN_KEY);
    if (!path) return;
    sessionStorage.removeItem(RESTORE_REOPEN_KEY);
    void openProject(path);
  }, [isOpen, openProject]);

  // Abrir automaticamente el ultimo proyecto, si el usuario lo pidio.
  useEffect(() => {
    if (!appSettingsLoaded || !appSettings.openLastProjectOnStart || isOpen) return;

    let cancelled = false;
    invoke<{ path: string }[]>('get_recent_projects')
      .then((projects) => {
        if (cancelled || !projects.length) return;
        openProject(projects[0].path);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [appSettingsLoaded, appSettings.openLastProjectOnStart, isOpen, openProject]);

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
    return (
      <>
        <ProjectSetup />
        <CloseGuard />
      </>
    );
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

      <CloseGuard />
    </div>
  );
};

export default App;
