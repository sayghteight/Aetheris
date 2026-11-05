import React, { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useI18n } from '../../i18n';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Plus, Feather, Search, X, Sparkles, Settings } from 'lucide-react';
import { AppSettingsDialog } from '../settings/AppSettingsDialog';
import './library.css';

interface ProjectProgress {
  last_scene_title: string | null;
  scenes_total: number;
  scenes_written: number;
}

/** Paletas de las cubiertas: dos tonos y la tinta del texto. */
const COVER_PALETTES = [
  { from: '#3a2c8f', to: '#16103d', ink: '#f1e9d6' },
  { from: '#a8502f', to: '#4a1d12', ink: '#f6e6d2' },
  { from: '#1f6b61', to: '#0b2e2b', ink: '#e4f1e8' },
  { from: '#59606f', to: '#262a35', ink: '#e9e9ee' },
  { from: '#7a2f52', to: '#33101f', ink: '#f6e0e8' },
  { from: '#2f5d7a', to: '#122a3a', ink: '#dfeaf2' },
  { from: '#6b5a1f', to: '#2e2610', ink: '#f3ecd2' },
  { from: '#3f6b2e', to: '#1a2e12', ink: '#e6f2de' },
];

/** Cubierta estable: la misma novela siempre tiene la misma paleta. */
const coverPalette = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
};

const BookCover: React.FC<{ title: string; author?: string | null }> = ({ title, author }) => {
  const palette = coverPalette(title);

  return (
    <div
      className="lib-book"
      style={{ background: `linear-gradient(160deg, ${palette.from}, ${palette.to} 70%)` }}
    >
      <div
        className="flex h-full flex-col justify-end p-5 pl-8"
        style={{ color: palette.ink }}
      >
        <p className="lib-serif text-xl font-semibold leading-tight line-clamp-3">{title}</p>
        {author && <p className="mt-1 text-xs opacity-70">{author}</p>}
      </div>
    </div>
  );
};

export const ProjectSetup: React.FC = () => {
  const { t, language } = useI18n();
  const { createProject, openProject, error, isLoading, clearError, loadRecentProjects, recentProjects, isOpen } = useProjectStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [createdPath, setCreatedPath] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  // La novela más reciente es la que encabeza la biblioteca.
  const featured = recentProjects[0] ?? null;

  useEffect(() => {
    if (!featured) {
      setProgress(null);
      return;
    }

    let cancelled = false;
    invoke<ProjectProgress>('get_project_progress', { path: featured.path })
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      });

    return () => {
      cancelled = true;
    };
  }, [featured?.path]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recentProjects;

    return recentProjects.filter((project) => {
      const haystack = [project.title, project.author ?? '', project.genre ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [recentProjects, query]);

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

  /** Tiempo transcurrido desde la ultima apertura, en lenguaje natural. */
  const formatRelative = (dateStr: string) => {
    try {
      const elapsed = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(elapsed / 60_000);
      const hours = Math.floor(elapsed / 3_600_000);
      const days = Math.floor(elapsed / 86_400_000);

      if (minutes < 1) return t('setup.justNow');
      if (minutes < 60) return t('setup.minutesAgo', { count: minutes });
      if (hours < 24) return t('setup.hoursAgo', { count: hours });
      if (days === 1) return t('setup.dayAgo');
      if (days < 30) return t('setup.daysAgo', { count: days });
      return formatDate(dateStr);
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
    const match = genres.find(g => g.key === genreKey);
    if (!match) return genreKey;
    return language === 'en' ? match.en : match.es;
  };

  const progressPercent =
    progress && progress.scenes_total > 0
      ? Math.round((progress.scenes_written / progress.scenes_total) * 100)
      : 0;

  const countLabel =
    filteredProjects.length === 1
      ? t('setup.novelSingular')
      : t('setup.novelsCount', { count: filteredProjects.length });

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      {/* Cabecera: marca, busqueda y acciones */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Feather className="w-4 h-4 text-white" />
            </div>
            <span className="lib-serif text-xl font-semibold tracking-tight">{t('app.name')}</span>
          </div>

          <label className="relative ml-auto hidden w-72 sm:block">
            <span className="sr-only">{t('setup.searchPlaceholder')}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('setup.searchPlaceholder')}
              className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-2 pl-9 pr-4 text-sm placeholder:text-[var(--color-text-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <button
            onClick={() => setAppSettingsOpen(true)}
            title={t('appSettings.title')}
            aria-label={t('appSettings.title')}
            className="lib-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Settings className="w-4 h-4" />
          </button>

          {isOpen ? (
            <button
              onClick={() => useProjectStore.getState().closeProject()}
              className="lib-ring rounded-full border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              {t('setup.closeProject')}
            </button>
          ) : (
            <button
              onClick={handleOpenProject}
              className="lib-ring rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
            >
              {t('setup.openProject')}
            </button>
          )}

          <button
            onClick={startCreating}
            className="lib-ring rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-primary)] hover:opacity-90"
          >
            {t('setup.newNovel')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl w-full px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        {!showForm ? (
          <>
            {/* Portada: seguir escribiendo + cubierta destacada */}
            <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <h1 className="lib-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                  {t('setup.title')}
                </h1>
                <p className="mt-4 max-w-md text-lg text-[var(--color-text-secondary)]">
                  {t('setup.subtitle')}
                </p>

                {featured && (
                  <div className="mt-9 max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5">
                    <p className="text-sm text-[var(--color-text-muted)]">{t('setup.continueTitle')}</p>
                    <h2 className="mt-1 lib-serif text-2xl font-semibold">{featured.title}</h2>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {progress?.last_scene_title
                        ? t('setup.lastScene', { title: progress.last_scene_title })
                        : t('setup.noSceneYet')}
                      {' · '}
                      {t('setup.lastEdited', { time: formatRelative(featured.last_opened) })}
                    </p>

                    {progress && progress.scenes_total > 0 && (
                      <>
                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium tabular-nums">{progressPercent} %</span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {t('setup.scenesProgress', {
                            written: progress.scenes_written,
                            total: progress.scenes_total,
                          })}
                        </p>
                      </>
                    )}

                    <button
                      onClick={() => handleRecentProject(featured.path)}
                      className="lib-ring mt-5 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-bg-primary)] hover:opacity-90"
                    >
                      {t('setup.continueWriting')}
                    </button>
                  </div>
                )}
              </div>

              {featured && (
                <button
                  onClick={() => handleRecentProject(featured.path)}
                  className="lib-group lib-ring mx-auto w-52 md:w-full"
                  aria-label={t('setup.continueWriting')}
                >
                  <BookCover title={featured.title} author={featured.author} />
                </button>
              )}
            </section>

            {/* Estanteria */}
            <section className="mt-20">
              <div className="flex items-baseline justify-between border-b border-[var(--color-border)] pb-3">
                <h2 className="lib-serif text-2xl font-semibold">{t('setup.recent')}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">{countLabel}</p>
              </div>

              {recentProjects.length > 0 ? (
                <>
                  <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredProjects.map((project) => (
                      <li key={project.path} className="lib-group">
                        <button
                          onClick={() => handleRecentProject(project.path)}
                          className="lib-ring block w-full text-left"
                        >
                          <BookCover title={project.title} author={project.author} />
                          <p className="mt-4 font-medium">{project.title}</p>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {[project.author, project.genre ? getGenreLabel(project.genre) : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {formatDate(project.last_opened)} · {project.path.split(/[/\\]/).pop()}
                          </p>
                        </button>
                      </li>
                    ))}

                    <li className="lib-group">
                      <button
                        onClick={startCreating}
                        className="lib-ring flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 rounded-[4px_10px_10px_4px] border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
                      >
                        <Plus className="w-7 h-7" />
                        <span className="text-sm font-medium">{t('setup.newNovel')}</span>
                      </button>
                    </li>
                  </ul>

                  {filteredProjects.length === 0 && (
                    <p className="mt-10 text-[var(--color-text-muted)]">{t('setup.noResults')}</p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t('setup.empty')}</p>
                  <p className="text-xs mt-1 text-[var(--color-text-muted)]">{t('setup.emptyHint')}</p>
                </div>
              )}
            </section>
          </>
        ) : (
          // Formulario de creacion
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="lib-serif text-3xl font-semibold">{t('setup.createTitle')}</h2>
              <button
                onClick={goBack}
                className="lib-ring w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
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
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {t('setup.novelTitle')} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('setup.novelTitlePlaceholder')}
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] rounded-xl px-4 py-3.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('setup.author')}
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={t('setup.authorPlaceholder')}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] rounded-xl px-4 py-3.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('setup.genre')} <span className="text-[var(--color-text-muted)]">{t('setup.genreOptional')}</span>
                  </label>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] rounded-xl px-4 py-3.5 text-[var(--color-text-primary)] outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">{t('setup.selectGenre')}</option>
                    {genres.map((g) => (
                      <option key={g.key} value={g.key}>{language === 'en' ? g.en : g.es}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {t('setup.synopsis')} <span className="text-[var(--color-text-muted)]">{t('setup.synopsisOptional')}</span>
                </label>
                <textarea
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder={t('setup.synopsisPlaceholder')}
                  rows={4}
                  className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] rounded-xl px-4 py-3.5 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] py-3.5 rounded-full font-medium transition-all"
                >
                  {t('setup.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !title.trim()}
                  className="flex-1 bg-[var(--color-accent)] hover:opacity-90 disabled:opacity-50 text-[var(--color-bg-primary)] py-3.5 rounded-full font-semibold transition-all"
                >
                  {isLoading ? t('setup.creating') : t('setup.createProject')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <AppSettingsDialog open={appSettingsOpen} onClose={() => setAppSettingsOpen(false)} />
    </div>
  );
};
