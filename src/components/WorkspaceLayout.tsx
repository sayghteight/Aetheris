import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useNavigationStore, ActiveView } from '../store/navigationStore';
import {
  BookOpen,
  Sparkles,
  Calendar,
  Settings,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  LogOut,
  Compass,
  Download,
  FileUp,
  Globe
} from 'lucide-react';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
  rightPanelContent?: React.ReactNode;
  wordCount?: number;
  readTime?: number;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ 
  children, 
  sidebarContent, 
  rightPanelContent,
  wordCount = 0,
  readTime = 0
}) => {
  const { currentProject, closeProject } = useProjectStore();
  const { 
    activeView, 
    setActiveView, 
    sidebarExpanded, 
    toggleSidebar, 
    rightPanelExpanded, 
    toggleRightPanel 
  } = useNavigationStore();

  const navItems = [
    { view: 'manuscript' as ActiveView, icon: BookOpen, label: 'Manuscrito' },
    { view: 'universe' as ActiveView, icon: Compass, label: 'Universo' },
    { view: 'timeline' as ActiveView, icon: Calendar, label: 'Línea Temporal' },
    { view: 'calendars' as ActiveView, icon: Globe, label: 'Calendarios' },
    { view: 'versioning' as ActiveView, icon: Download, label: 'Actualizar' },
    { view: 'import' as ActiveView, icon: FileUp, label: 'Importar' },
    { view: 'settings' as ActiveView, icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-violet-600 selection:text-white">
      {/* Top Header */}
      <header className="h-12 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-md flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold tracking-wider text-sm bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            AETHERIA
          </span>
          <span className="text-xs text-slate-600">|</span>
          <span className="text-xs text-slate-400 font-medium">
            {currentProject?.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={closeProject}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-md border border-transparent hover:border-red-900/30 transition-all duration-200"
            title="Cerrar Proyecto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Bar (Slim Left Column) */}
        <nav className="w-16 border-r border-slate-900 bg-slate-950 flex flex-col items-center justify-between py-4 shrink-0">
          <div className="flex flex-col gap-3 w-full items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => setActiveView(item.view)}
                  className={`group relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isActive 
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {/* Tooltip */}
                  <span className="absolute left-14 scale-0 group-hover:scale-100 bg-slate-900 border border-slate-800 text-slate-100 text-xs px-2 py-1 rounded shadow-md whitespace-nowrap transition-all duration-100 origin-left z-30">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-600">v0.1</div>
        </nav>

        {/* Collapsible Sub-Sidebar (Manuscript / Universe selector context) */}
        {activeView === 'manuscript' ? (
          <div 
            className={`border-r border-slate-900 bg-slate-900/20 transition-all duration-300 flex flex-col overflow-hidden ${
              sidebarExpanded ? 'w-64' : 'w-0 border-r-0'
            }`}
          >
            {sidebarContent}
          </div>
        ) : null}

        {/* Central Work Area */}
        <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
          {/* Panel Toggle Controllers */}
          {activeView === 'manuscript' ? (
            <>
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80 rounded-md transition-colors"
                  title={sidebarExpanded ? "Esconder Panel Izquierdo" : "Mostrar Panel Izquierdo"}
                >
                  {sidebarExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
                </button>
              </div>

              <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={toggleRightPanel}
                  className="p-1.5 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80 rounded-md transition-colors"
                  title={rightPanelExpanded ? "Esconder Panel Derecho" : "Mostrar Panel Derecho"}
                >
                  {rightPanelExpanded ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                </button>
              </div>
            </>
          ) : null}

          {/* Central Workspace Content */}
          <div className="flex-1 overflow-auto p-8 pt-16">
            {children}
          </div>
        </main>

        {/* Collapsible Right Sidebar (Attributes, Comments) */}
        {activeView === 'manuscript' ? (
          <div 
            className={`border-l border-slate-900 bg-slate-900/10 transition-all duration-300 flex flex-col overflow-hidden ${
              rightPanelExpanded ? 'w-80' : 'w-0 border-l-0'
            }`}
          >
            {rightPanelContent}
          </div>
        ) : null}
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-4 text-xs text-slate-500 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span>Palabras: <strong className="text-slate-400">{wordCount}</strong></span>
          <span className="text-slate-800">|</span>
          <span>Lectura: <strong className="text-slate-400">~{readTime} min</strong></span>
          <span className="text-slate-800">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-500 font-semibold">Offline</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span>Meta Diaria: <strong className="text-violet-400">{wordCount} / 1000 palabras</strong></span>
          <div className="w-24 bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 h-full w-[45%]" />
          </div>
        </div>
      </footer>
    </div>
  );
};
