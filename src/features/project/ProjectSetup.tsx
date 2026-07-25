import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useI18n } from '../../i18n';
import { open, save } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Plus, Feather, BookOpen, Clock, X, ChevronRight, Sparkles } from 'lucide-react';

export const ProjectSetup: React.FC = () => {
  const { t, language } = useI18n();
  const { createProject, openProject, error, isLoading, clearError, loadRecentProjects, recentProjects, isOpen } = useProjectStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  const handleOpenProject = async () => {
    try {
      clearError();
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Novela Aer', extensions: ['aer'] }]
      });
      if (selected && typeof selected === 'string') {
        await openProject(selected);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      clearError();
      const selectedPath = await save({
        filters: [{ name: 'Novela Aer', extensions: ['aer'] }],
        defaultPath: `${title.trim().toLowerCase().replace(/\s+/g, '-')}.aer`
      });

      if (selectedPath) {
        setCreatedPath(selectedPath);
        await createProject(selectedPath, title, author, genre, synopsis);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecentProject = async (path: string) => {
    try {
      clearError();
      await openProject(path);
    } catch (err) {
      console.error(err);
    }
  };

  const startCreating = () => {
    setShowForm(true);
    setCreatedPath(null);
  };

  const goBack = () => {
    setShowForm(false);
    setCreatedPath(null);
    setTitle('');
    setAuthor('');
    setGenre('');
    setSynopsis('');
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const genres = [
    { key: 'Fantasy', es: 'Fantasía', en: 'Fantasy' },
    { key: 'ScienceFiction', es: 'Ciencia Ficción', en: 'Science Fiction' },
    { key: 'Romance', es: 'Romance', en: 'Romance' },
    { key: 'Thriller', es: 'Thriller', en: 'Thriller' },
    { key: 'Horror', es: 'Terror', en: 'Horror' },
    { key: 'Adventure', es: 'Aventura', en: 'Adventure' },
    { key: 'Drama', es: 'Drama', en: 'Drama' },
    { key: 'Comedy', es: 'Comedia', en: 'Comedy' },
    { key: 'Mystery', es: 'Misterio', en: 'Mystery' },
    { key: 'Dystopia', es: 'Distopía', en: 'Dystopia' },
    { key: 'Utopia', es: 'Utopía', en: 'Utopia' },
    { key: 'Historical', es: 'Novela Histórica', en: 'Historical Fiction' },
    { key: 'MagicalRealism', es: 'Realismo Mágico', en: 'Magical Realism' },
    { key: 'YoungAdult', es: 'Juvenil', en: 'Young Adult' },
    { key: 'Erotic', es: 'Erótica', en: 'Erotic' },
    { key: 'Humor', es: 'Humor', en: 'Humor' },
    { key: 'SelfHelp', es: 'Autoayuda', en: 'Self-Help' },
    { key: 'Other', es: 'Otro', en: 'Other' },
  ];

  const getGenreLabel = (genreKey: string) => {
    const genre = genres.find(g => g.key === genreKey);
    if (!genre) return genreKey;
    return language === 'en' ? genre.en : genre.es;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-violet-500 selection:text-white">
      {/* Fondo con degradado ambiental */}
      <div className="absolute inset-0 bg-radial-at-t from-violet-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Feather className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">{t('app.name')}</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{t('app.tagline')}</p>
              </div>
            </div>
            {isOpen && (
              <button
                onClick={() => useProjectStore.getState().closeProject()}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {t('setup.closeProject')}
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
          {!showForm ? (
            // Biblioteca - Home view
            <div className="space-y-10">
              {/* Hero section */}
              <div className="text-center py-8">
                <h2 className="text-4xl font-extrabold tracking-tight mb-3">
                  <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    {t('setup.title')}
                  </span>
                </h2>
                <p className="text-slate-400 max-w-md mx-auto">
                  {t('setup.subtitle')}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={startCreating}
                  className="group flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-2xl text-white font-semibold shadow-xl shadow-violet-500/20 transition-all duration-300 hover:scale-105"
                >
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                    <Plus className="w-5 h-5" />
                  </div>
                  {t('setup.newNovel')}
                </button>

                <button
                  onClick={handleOpenProject}
                  className="group flex items-center gap-3 px-6 py-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-2xl text-slate-200 font-medium transition-all duration-300 hover:scale-105"
                >
                  <div className="w-10 h-10 bg-emerald-950/50 group-hover:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-400 transition-colors">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  {t('setup.openProject')}
                </button>
              </div>

              {/* Recent Projects */}
              {recentProjects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t('setup.recent')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentProjects.map((project) => (
                      <button
                        key={project.path}
                        onClick={() => handleRecentProject(project.path)}
                        className="group relative bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-violet-500/40 rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-violet-950/50 group-hover:bg-violet-900/50 rounded-xl flex items-center justify-center text-violet-400 transition-colors flex-shrink-0">
                            <BookOpen className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                              {project.title}
                            </h4>
                            {project.author && (
                              <p className="text-xs text-slate-500 mt-0.5">{project.author}</p>
                            )}
                            {project.genre && (
                              <span className="inline-block mt-2 px-2 py-0.5 bg-slate-800 group-hover:bg-slate-700 rounded-md text-[10px] text-slate-400">
                                {getGenreLabel(project.genre)}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">
                            {formatDate(project.last_opened)}
                          </span>
                          <span className="text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors truncate max-w-[150px]">
                            {project.path.split(/[/\\]/).pop()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {recentProjects.length === 0 && (
                <div className="text-center py-16 text-slate-600">
                  <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-slate-700" />
                  </div>
                  <p className="text-sm">{t('setup.empty')}</p>
                  <p className="text-xs mt-1">{t('setup.emptyHint')}</p>
                </div>
              )}
            </div>
          ) : (
            // Create form
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">{t('setup.createTitle')}</h2>
                <button
                  onClick={goBack}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-red-950/50 border border-red-800 text-red-200 text-sm rounded-xl p-4 mb-6 flex justify-between items-center">
                  <span>{error}</span>
                  <button onClick={clearError} className="hover:text-white font-bold">&times;</button>
                </div>
              )}

              {createdPath && (
                <div className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 text-sm rounded-xl p-4 mb-6">
                  <p className="font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('setup.created')}
                  </p>
                  <p className="text-xs text-emerald-400/70 mt-1 truncate">{createdPath}</p>
                </div>
              )}

              <form onSubmit={handleCreateProject} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('setup.novelTitle')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('setup.novelTitlePlaceholder')}
                    className="w-full bg-slate-900/50 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3.5 text-slate-200 placeholder-slate-600 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('setup.author')}
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder={t('setup.authorPlaceholder')}
                      className="w-full bg-slate-900/50 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3.5 text-slate-200 placeholder-slate-600 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t('setup.genre')} <span className="text-slate-600">{t('setup.genreOptional')}</span>
                    </label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3.5 text-slate-200 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">{t('setup.selectGenre')}</option>
                      {genres.map((g) => (
                        <option key={g.key} value={g.key}>{language === 'en' ? g.en : g.es}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t('setup.synopsis')} <span className="text-slate-600">{t('setup.synopsisOptional')}</span>
                  </label>
                  <textarea
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder={t('setup.synopsisPlaceholder')}
                    rows={4}
                    className="w-full bg-slate-900/50 border border-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl px-4 py-3.5 text-slate-200 placeholder-slate-600 outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 py-3.5 rounded-xl font-medium transition-all"
                  >
                    {t('setup.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !title.trim()}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-violet-500/20 transition-all"
                  >
                    {isLoading ? t('setup.creating') : t('setup.createProject')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
