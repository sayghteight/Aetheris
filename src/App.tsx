import React, { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from './store/projectStore';
import { useNavigationStore } from './store/navigationStore';
import { useManuscriptStore } from './store/manuscriptStore';
import { useSettingsStore } from './store/settingsStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { useI18n } from './i18n';
import { ProjectSetup } from './features/project/ProjectSetup';
import { WorkspaceLayout } from './components/WorkspaceLayout';
import { ManuscriptTree } from './features/manuscript/ManuscriptTree';
import { SceneEditor } from './features/project/UniversePanel';
import { FileText, Edit, BarChart, BookOpen } from 'lucide-react';
import { ProjectSettings } from './features/project/ProjectSettings';
import { UpdatePanel } from './features/project/UpdatePanel';
import { UniversePanel } from './features/project/UniversePanel';
import { WordImportPanel } from './features/import/WordImportPanel';
import { TimelinePanel } from './features/project/TimelinePanel';
import { CalendarsPanel } from './features/project/CalendarsPanel';
import { UpdateDialog } from './components/UpdateDialog';

const App: React.FC = () => {
  const { isOpen } = useProjectStore();
  const { activeView, activeSceneId, selectedNodeId } = useNavigationStore();
  const { nodes, updateNode } = useManuscriptStore();
  const { settings, loadSettings, isLoaded } = useSettingsStore();
  const { language, setLanguage, t } = useI18n();
  const [stats, setStats] = useState({ words: 0, readTime: 0 });

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

  // Contenido de la columna derecha (Propiedades de escena/notas)
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const handleMetadataChange = useCallback(
    (field: 'synopsis' | 'writing_goals' | 'author_notes', value: string) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { ...selectedNode, [field]: value || null });
    },
    [selectedNode, updateNode]
  );

  const renderRightPanel = () => {
    if (activeView !== 'manuscript') {
      return null;
    }

    if (!selectedNode) {
      return (
        <div className="p-4 flex flex-col gap-4 text-xs h-full overflow-y-auto">
          <div className="text-slate-600 text-center py-12">
            {t('editor.noSceneSelected')}
          </div>
        </div>
      );
    }

    const isScene = selectedNode.type === 'scene';

    return (
      <div className="p-4 flex flex-col gap-4 text-xs h-full overflow-y-auto">
        <h3 className="font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          {isScene ? (
            <>
              <Edit className="w-3.5 h-3.5 text-violet-400" />
              {t('manuscript.status')} / {t('editor.title')}
            </>
          ) : (
            <>
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              {t('manuscript.chapterMetadata')}
            </>
          )}
        </h3>

        {isScene ? (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('manuscript.status')}</label>
              <select className="w-full bg-slate-950 border border-slate-900 focus:border-violet-500 rounded px-2 py-1.5 text-xs outline-none">
                <option value="draft">{t('manuscript.draft')}</option>
                <option value="review">{t('manuscript.review')}</option>
                <option value="final">{t('manuscript.final')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('manuscript.quickNotes')}</label>
              <textarea
                placeholder={t('manuscript.quickNotesPlaceholder')}
                rows={4}
                className="w-full bg-slate-950 border border-slate-900 focus:border-violet-500 rounded px-2.5 py-1.5 text-xs outline-none resize-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-900 space-y-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart className="w-3.5 h-3.5 text-fuchsia-400" /> {t('manuscript.metrics')}
              </span>
              <div className="text-slate-400 flex flex-col gap-1 text-[11px]">
                <div className="flex justify-between"><span>{t('manuscript.lines')}:</span> <span className="text-slate-350">{Math.ceil(stats.words / 12)}</span></div>
                <div className="flex justify-between"><span>{t('manuscript.words')}:</span> <span className="text-slate-350">{stats.words}</span></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('manuscript.synopsis')}</label>
              <textarea
                value={selectedNode.synopsis ?? ''}
                onChange={(e) => handleMetadataChange('synopsis', e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-900 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs outline-none resize-none text-slate-200"
                placeholder={t('manuscript.synopsis')}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('manuscript.writingGoals')}</label>
              <textarea
                value={selectedNode.writing_goals ?? ''}
                onChange={(e) => handleMetadataChange('writing_goals', e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-900 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs outline-none resize-none text-slate-200"
                placeholder={t('manuscript.writingGoals')}
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('manuscript.authorNotes')}</label>
              <textarea
                value={selectedNode.author_notes ?? ''}
                onChange={(e) => handleMetadataChange('author_notes', e.target.value)}
                rows={4}
                className="w-full bg-slate-950 border border-slate-900 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs outline-none resize-none text-slate-200"
                placeholder={t('manuscript.authorNotes')}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Contenido principal de la vista activa
  const renderMainView = () => {
    switch (activeView) {
      case 'manuscript':
        return (
          <div className="w-full h-full flex flex-col">
            {activeSceneId ? (
              <div className="flex-1 flex flex-col h-full bg-slate-900/10 border border-slate-900 rounded-2xl p-6 shadow-xl">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                  <FileText className="w-6 h-6 text-violet-400" />
                  {t('editor.title')}
                </h2>
                <div className="flex-1 flex flex-col min-h-0">
                  <SceneEditor
                    sceneId={activeSceneId}
                    onStatsUpdate={(w: number, t: number) => setStats({ words: w, readTime: t })}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 mb-4 text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-slate-300">{t('editor.noSceneSelected')}</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  {t('editor.noSceneHint')}
                </p>
              </div>
            )}
          </div>
        );
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
        <WorkspaceLayout
          sidebarContent={activeView === 'manuscript' ? <ManuscriptTree /> : null}
          rightPanelContent={renderRightPanel()}
          wordCount={stats.words}
          readTime={stats.readTime}
        >
          {renderMainView()}
        </WorkspaceLayout>
        <UpdateDialog />
      </div>
    </div>
  );
};

export default App;
