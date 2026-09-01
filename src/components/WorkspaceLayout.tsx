import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { openMainViewTab } from '../store/tabStore';
import { APP_VERSION } from '../utils/version';
import { SearchPanel } from '../features/search/SearchPanel';
import {
  BookOpen,
  Sparkles,
  Calendar,
  Settings,
  Compass,
  FileUp,
  FileDown,
  Globe,
  Search,
  Maximize2,
  Minimize2,
  LogOut,
} from 'lucide-react';

// Type for navigation views that can be opened as tabs
type MainViewTabType = 'manuscript' | 'universe' | 'timeline' | 'calendars' | 'settings' | 'about' | 'versioning' | 'import' | 'export';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  wordCount?: number;
  readTime?: number;
  tabBar?: React.ReactNode;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  wordCount = 0,
  readTime = 0,
  tabBar,
}) => {
  const { currentProject, closeProject } = useProjectStore();
  const { settings, saveSettings } = useSettingsStore();
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut: Ctrl+Shift+F to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const toggleFocusMode = () => {
    const next = settings.focus_mode === 'standard' ? 'focus' : 'standard';
    saveSettings({ ...settings, focus_mode: next });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-hidden font-sans selection:bg-[var(--color-accent)] selection:text-[var(--color-text-inverse)]">
      {/* Top bar */}
      <header className="h-12 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-sm flex items-center justify-between px-4 z-20 shrink-0">
        {/* Left — back + project info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button */}
          <button
            onClick={() => openMainViewTab('manuscript')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors duration-150 shrink-0"
            title="Volver al manuscrito"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Exit button */}
          <button
            onClick={closeProject}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg-hover)] transition-colors duration-150 shrink-0"
            title="Salir al selector de proyectos"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Project info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500/80 to-orange-600/80 rounded flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white/90" />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-sm text-[var(--color-text-primary)] font-semibold truncate leading-tight">{currentProject?.title}</span>
              {currentProject?.author && (
                <span className="text-[11px] text-[var(--color-text-muted)] truncate leading-tight">{currentProject.author}</span>
              )}
            </div>
          </div>
          {currentProject?.genre && (
            <span className="text-[10px] text-[var(--color-accent)] bg-[var(--color-accent-bg)] px-1.5 py-0.5 rounded border border-[var(--color-accent-border)] shrink-0">
              {currentProject.genre}
            </span>
          )}
        </div>

        {/* Right — search + focus mode */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <div className={`items-center gap-2 transition-all duration-200 ${searchOpen ? 'flex' : 'flex'}`}>
            {searchOpen ? (
              <div className="w-[420px] h-[500px] absolute top-14 right-4 z-50 shadow-2xl rounded-2xl overflow-hidden">
                <SearchPanel />
              </div>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors duration-150"
                title="Buscar (Ctrl+Shift+F)"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Focus mode toggle */}
          <button
            onClick={toggleFocusMode}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors duration-150 ${
              settings.focus_mode !== 'standard'
                ? 'text-[var(--color-accent)] bg-[var(--color-accent-bg)] hover:bg-[var(--color-accent-bg)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
            }`}
            title={settings.focus_mode === 'standard' ? 'Activar modo foco' : 'Desactivar modo foco'}
          >
            {settings.focus_mode === 'standard' ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Bar (Slim Left Column) */}
        <nav className="w-48 border-r border-[var(--color-border)] bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] flex flex-col shrink-0">
          {/* Logo area */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold tracking-widest text-[var(--color-text-secondary)] uppercase">Aetheria</span>
            </div>
          </div>

          {/* Section label */}
          <div className="px-4 mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">Proyecto</span>
          </div>

          {/* Navigation items */}
          <div className="flex flex-col gap-0.5 px-2">
            {([
              { view: 'manuscript', icon: BookOpen, label: 'Manuscrito' },
              { view: 'universe', icon: Compass, label: 'Universo' },
              { view: 'timeline', icon: Calendar, label: 'Línea Temporal' },
              { view: 'calendars', icon: Globe, label: 'Calendarios' },
            ] as { view: MainViewTabType; icon: React.ComponentType<{ className?: string }>; label: string }[]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => openMainViewTab(item.view)}
                  className="group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                  <span className="text-xs font-medium flex-1 tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tools section */}
          <div className="px-4 mt-4 mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">Herramientas</span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {([
              { view: 'import' as MainViewTabType, icon: FileUp, label: 'Importar' },
              { view: 'export' as MainViewTabType, icon: FileDown, label: 'Exportar' },
            ] as { view: MainViewTabType; icon: React.ComponentType<{ className?: string }>; label: string }[]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => openMainViewTab(item.view)}
                  className="group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                  <span className="text-xs font-medium flex-1 tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Config section */}
          <div className="px-4 mt-4 mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-medium">Configuración</span>
          </div>

          <div className="flex flex-col gap-0.5 px-2">
            {([
              { view: 'settings' as MainViewTabType, icon: Settings, label: 'Ajustes' },
              { view: 'about' as MainViewTabType, icon: FileUp, label: 'Acerca de' },
            ] as { view: MainViewTabType; icon: React.ComponentType<{ className?: string }>; label: string }[]).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.view}
                  onClick={() => openMainViewTab(item.view)}
                  className="group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]" />
                  <span className="text-xs font-medium flex-1 tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />


          {/* Version */}
          <div className="pb-4 text-center">
            <button
              onClick={() => openMainViewTab('versioning')}
              className="text-xs text-[var(--color-text-muted)] font-mono hover:text-[var(--color-accent)] transition-colors cursor-pointer"
            >
              v{APP_VERSION}
            </button>
          </div>
        </nav>

        {/* Central Work Area */}
        <main className="flex-1 flex flex-col min-h-0 bg-[var(--color-bg-primary)] overflow-hidden">
          {tabBar}
          {children}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-10 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 flex items-center justify-between px-4 text-xs text-[var(--color-text-muted)] shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>Palabras: <strong className="text-[var(--color-text-secondary)]">{wordCount}</strong></span>
          <span className="opacity-40">·</span>
          <span>Lectura: <strong className="text-[var(--color-text-secondary)]">~{readTime} min</strong></span>
          <span className="opacity-40">·</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-500 font-semibold">Offline</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span>Meta Diaria: <strong className="text-[var(--color-accent)]">{wordCount} / 1000</strong></span>
          <div className="w-24 bg-[var(--color-bg-tertiary)] rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-500 h-full w-[45%]" />
          </div>
        </div>
      </footer>
    </div>
  );
};
