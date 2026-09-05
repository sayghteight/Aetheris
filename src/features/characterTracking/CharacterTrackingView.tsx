import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  User,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Info,
  X,
  BookOpen,
  Sparkles,
  Eye,
  Clock,
  TrendingUp,
  Ghost,
} from 'lucide-react';
import { useCharacterTrackingStore, CharacterTrackingData, SceneInfo } from '../../store/characterTrackingStore';
import { useNavigationStore } from '../../store/navigationStore';

const STATUS_CONFIG = {
  alive: { color: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Alive' },
  dead: { color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Dead' },
  missing: { color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Missing' },
};

export const CharacterTrackingView: React.FC = () => {
  const {
    trackingData,
    chapters,
    isLoading,
    selectedCharacterId,
    searchQuery,
    loadTrackingData,
    rebuildTracking,
    selectCharacter,
    setSearchQuery,
    getScenesForCharacter,
    getInsights,
  } = useCharacterTrackingStore();

  const { setActiveSceneId } = useNavigationStore();

  const [characterScenes, setCharacterScenes] = useState<SceneInfo[]>([]);
  const [selectedDetailCharacter, setSelectedDetailCharacter] = useState<CharacterTrackingData | null>(null);

  useEffect(() => {
    loadTrackingData();

    const handleSceneSaved = () => {
      loadTrackingData();
    };

    window.addEventListener('scene-saved', handleSceneSaved);
    return () => {
      window.removeEventListener('scene-saved', handleSceneSaved);
    };
  }, [loadTrackingData]);

  useEffect(() => {
    if (selectedCharacterId) {
      getScenesForCharacter(selectedCharacterId).then(setCharacterScenes);
      const char = trackingData.find((c) => c.characterId === selectedCharacterId);
      if (char) {
        setSelectedDetailCharacter(char);
      }
    } else {
      setCharacterScenes([]);
      setSelectedDetailCharacter(null);
    }
  }, [selectedCharacterId, trackingData, getScenesForCharacter]);

  const insights = useMemo(() => getInsights(), [trackingData, chapters]);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) return trackingData;
    const q = searchQuery.toLowerCase();
    return trackingData.filter((c) => c.characterName.toLowerCase().includes(q));
  }, [trackingData, searchQuery]);

  const handleSceneClick = (sceneId: string) => {
    setActiveSceneId(sceneId);
  };

  const handleCharacterClick = (characterId: string) => {
    selectCharacter(characterId);
  };

  const getChapterNumber = (chapterId: string): number => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    return idx + 1;
  };

  const groupScenesByChapter = (scenes: SceneInfo[]): Map<string, SceneInfo[]> => {
    const groups = new Map<string, SceneInfo[]>();
    for (const scene of scenes) {
      const chapter = chapters.find((c) => c.id === scene.parentId);
      const chapterId = chapter?.id || 'orphan';
      const existing = groups.get(chapterId) || [];
      existing.push(scene);
      groups.set(chapterId, existing);
    }
    return groups;
  };

  const totalChapters = chapters.length;
  const activeCharacters = trackingData.filter((c) => c.totalAppearances > 0 && c.characterStatus === 'alive').length;

  return (
    <div className="flex h-full bg-[var(--color-bg-primary)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)]">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                  Character Tracking
                </h1>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Monitor character presence across your story
                </p>
              </div>
            </div>
            <button
              onClick={() => rebuildTracking()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="p-4 rounded-xl bg-[var(--color-bg-primary)]/80 border border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{trackingData.length}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Characters</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-primary)]/80 border border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{activeCharacters}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Active in Story</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-bg-primary)]/80 border border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{totalChapters}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Chapters</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search characters..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 text-[var(--color-text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Insights */}
          {insights.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  Writing Insights
                </h3>
              </div>
              <div className="grid gap-2">
                {insights.map((insight, idx) => (
                  <div
                    key={`${insight.characterId}-${idx}`}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl ${
                      insight.type === 'warning'
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}
                  >
                    {insight.type === 'warning' ? (
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${insight.type === 'warning' ? 'text-amber-200' : 'text-blue-200'}`}>
                      {insight.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Character Grid */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4 flex items-center gap-2">
              <span>Characters</span>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs">
                {filteredCharacters.length}
              </span>
            </h3>

            {filteredCharacters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCharacters.map((char) => {
                  const status = STATUS_CONFIG[char.characterStatus] || STATUS_CONFIG.alive;
                  const isSelected = selectedCharacterId === char.characterId;

                  return (
                    <button
                      key={char.characterId}
                      onClick={() => handleCharacterClick(char.characterId)}
                      className={`relative p-5 rounded-2xl text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-violet-500/10 border-2 border-violet-500 shadow-lg shadow-violet-500/10'
                          : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-violet-500/30 hover:shadow-md'
                      }`}
                    >
                      {/* Status indicator line */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                        style={{ backgroundColor: status.color + '40' }}
                      />

                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                            <User className="w-7 h-7 text-violet-400" />
                          </div>
                          <div
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[var(--color-bg-secondary)]"
                            style={{ backgroundColor: status.color }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-[var(--color-text-primary)] truncate">
                              {char.characterName}
                            </h4>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${status.bg} ${status.text}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-lg font-bold text-[var(--color-text-primary)]">
                              {char.totalAppearances}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">appearances</p>
                          </div>
                          <div className="h-8 w-px bg-[var(--color-border)]" />
                          <div>
                            <p className="text-lg font-bold text-[var(--color-text-primary)]">
                              {char.appearancePercentage.toFixed(0)}%
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">coverage</p>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {char.totalAppearances > 0 && (
                        <div className="mt-4">
                          <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${char.appearancePercentage}%`,
                                backgroundColor: status.color,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Dead/Missing indicator */}
                      {(char.characterStatus === 'dead' || char.characterStatus === 'missing') && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                          <Ghost className="w-3.5 h-3.5" />
                          <span>Character arc completed</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-3xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-slate-600" />
                </div>
                <h4 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                  No characters yet
                </h4>
                <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
                  Create characters in the Universe panel to start tracking their appearances
                </p>
              </div>
            )}
          </div>

          {/* Chapter Matrix */}
          {chapters.length > 0 && filteredCharacters.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
                  Chapter Distribution
                </h3>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left text-xs font-semibold text-[var(--color-text-muted)] px-4 py-3 sticky left-0 bg-[var(--color-bg-secondary)]">
                          Character
                        </th>
                        {chapters.map((chapter, idx) => (
                          <th
                            key={chapter.id}
                            className="text-center text-xs font-semibold text-[var(--color-text-muted)] px-2 py-3 min-w-[36px]"
                          >
                            <div className="flex flex-col items-center">
                              <span>Ch</span>
                              <span className="text-lg font-bold">{idx + 1}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCharacters.map((char) => {
                        const status = STATUS_CONFIG[char.characterStatus] || STATUS_CONFIG.alive;
                        return (
                          <tr key={char.characterId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]/30 transition-colors">
                            <td className="px-4 py-3 sticky left-0 bg-[var(--color-bg-secondary)]">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: status.color }}
                                />
                                <span className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-[120px]">
                                  {char.characterName}
                                </span>
                              </div>
                            </td>
                            {chapters.map((chapter) => {
                              const hasAppearance = char.chapterIds.includes(chapter.id);
                              return (
                                <td key={chapter.id} className="px-2 py-3 text-center">
                                  {hasAppearance ? (
                                    <div className="w-5 h-5 rounded-full bg-violet-500 mx-auto flex items-center justify-center">
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-700 mx-auto" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedDetailCharacter && (
        <div className="w-[400px] border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
        {/* Panel Header */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-violet-400" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[var(--color-bg-secondary)]"
                  style={{ backgroundColor: STATUS_CONFIG[selectedDetailCharacter.characterStatus].color }}
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {selectedDetailCharacter.characterName}
                </h2>
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mt-1 ${
                    STATUS_CONFIG[selectedDetailCharacter.characterStatus].bg
                  } ${STATUS_CONFIG[selectedDetailCharacter.characterStatus].text}`}
                >
                  {STATUS_CONFIG[selectedDetailCharacter.characterStatus].label}
                </span>
              </div>
            </div>
            <button
              onClick={() => selectCharacter(null)}
              className="p-2 rounded-xl hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] text-center">
              <p className="text-2xl font-bold text-violet-400">
                {selectedDetailCharacter.totalAppearances}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Appearances</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] text-center">
              <p className="text-2xl font-bold text-emerald-400">
                {selectedDetailCharacter.appearancePercentage.toFixed(0)}%
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Coverage</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-bg-primary)] text-center">
              <p className="text-2xl font-bold text-amber-400">
                {selectedDetailCharacter.lastChapterIndex >= 0
                  ? selectedDetailCharacter.lastChapterIndex + 1
                  : '-'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">Last Seen</p>
            </div>
          </div>
        </div>

        {/* Scenes List */}
        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Scenes ({characterScenes.length})
          </h3>

          {characterScenes.length > 0 ? (
            <div className="space-y-4">
              {Array.from(groupScenesByChapter(characterScenes)).map(([chapterId, scenes]) => {
                const chapter = chapters.find((c) => c.id === chapterId);
                const chapterNum = getChapterNumber(chapterId);
                return (
                  <div key={chapterId}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {chapter?.title || `Chapter ${chapterNum}`}
                      </span>
                    </div>
                    <div className="ml-8 space-y-1">
                      {scenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => handleSceneClick(scene.id)}
                          className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-xl hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all group"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
                          <span className="text-sm truncate">{scene.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Ghost className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm text-[var(--color-text-muted)]">No scenes found</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
