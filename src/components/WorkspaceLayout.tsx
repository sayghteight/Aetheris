import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useNavigationStore, ActiveView } from '../store/navigationStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSettingsStore } from '../store/settingsStore';
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
} from 'lucide-react';

// Read version from package.json at runtime
const APP_VERSION = '0.1.3';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  wordCount?: number;
  readTime?: number;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  wordCount = 0,
  readTime = 0,
}) => {
  const { currentProject } = useProjectStore();
  const { activeView } = useNavigationStore();
  const { setActiveView } = useWorkspaceStore();
  const { settings, saveSettings } = useSettingsStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFocusMode = () => {
    const next = settings.focus_mode === 'standard' ? 'focus' : 'standard';
    saveSettings({ ...settings, focus_mode: next });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-amber-600 selection:text-white">
      {/* Top bar */}
      <header className="h-12 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-between px-4 z-20 shrink-0">
        {/* Left — back + project info */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button */}
          <button
            onClick={() => setActiveView('manuscript')}
            className="w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors duration-150 shrink-0"
            title="Volver al manuscrito"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Project info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500/80 to-orange-600/80 rounded flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-white/90" />
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-sm text-slate-200 font-semibold truncate leading-tight">{currentProject?.title}</span>
              {currentProject?.author && (
                <span className="text-[11px] text-slate-500 truncate leading-tight">{currentProject.author}</span>
              )}
            </div>
          </div>
          {currentProject?.genre && (
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
              {currentProject.genre}
            </span>
          )}
        </div>

        {/* Right — search + focus mode */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <div className={`flex items-center gap-2 transition-all duration-200 ${searchOpen ? 'w-64' : 'w-8'}`}>
            {searchOpen ? (
              <>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/60"
                  onBlur={() => { setSearchOpen(false); setSearchQuery(''); }}
                />
              </>
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors duration-150"
                title="Buscar (⌘K)"
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
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
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
        <nav className="w-48 border-r border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950 flex flex-col shrink-0">
          {/* Logo area */}
          <div className="px-4 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-xs font-semibold tracking-widest text-slate-300 uppercase">Aetheria</span>
            </div>
          </div>

          {/* Section label */}
          <div className="px-4 mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Proyecto</span>
          </div>

          {/* Navigation items */}
          <div className="flex flex-col gap-0.5 px-2">
            {[
              { view: 'manuscript' as ActiveView, icon: BookOpen, label: 'Manuscrito' },
              { view: 'universe' as ActiveView, icon: Compass, label: 'Universo' },
              { view: 'timeline' as ActiveView, icon: Calendar, label: 'Línea Temporal' },
              { view: 'calendars' as ActiveView, icon: Globe, label: 'Calendarios' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 ${
                    isActive
                      ? 'text-amber-200'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {/* Active indicator - left border accent */}
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-amber-500 rounded-full" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                  <span className="text-xs font-medium flex-1 tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tools section */}
          <div className="px-4 mt-4 mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Herramientas</span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {[
              { view: 'import' as ActiveView, icon: FileUp, label: 'Importar' },
              { view: 'export' as ActiveView, icon: FileDown, label: 'Exportar' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 ${
                    isActive
                      ? 'text-amber-200'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-amber-500 rounded-full" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
                  <span className="text-xs font-medium flex-1 tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Config section */}
          <div className="px-4 mt-4 mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Configuración</span>
          </div>
          
          <div className="flex flex-col gap-0.5 px-2">
            {[
              { view: 'settings' as ActiveView, icon: Settings, label: 'Ajustes' },
              { view: 'about' as ActiveView, icon: FileUp, label: 'Acerca de' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`group relative flex items-center gap-2.5 pl-3 pr-2 py-2 rounded text-left transition-all duration-150 ${
                    isActive
                      ? 'text-amber-200'
                      : 'text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-amber-500 rounded-full" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-amber-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
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
              onClick={() => setActiveView('versioning')}
              className="text-xs text-slate-600 font-mono hover:text-amber-500 transition-colors cursor-pointer"
            >
              v{APP_VERSION}
            </button>
          </div>
        </nav>

        {/* Central Work Area */}
        <main className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-10 border-t border-slate-800/60 bg-slate-950/80 flex items-center justify-between px-4 text-xs text-slate-500 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>Palabras: <strong className="text-slate-400">{wordCount}</strong></span>
          <span className="text-slate-700">·</span>
          <span>Lectura: <strong className="text-slate-400">~{readTime} min</strong></span>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-500 font-semibold">Offline</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span>Meta Diaria: <strong className="text-amber-400">{wordCount} / 1000</strong></span>
          <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-500 h-full w-[45%]" />
          </div>
        </div>
      </footer>
    </div>
  );
};
