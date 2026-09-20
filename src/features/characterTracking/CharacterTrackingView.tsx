import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  User,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Info,
  BookOpen,
  Sparkles,
  Eye,
  Clock,
  TrendingUp,
  Ghost,
  LayoutDashboard,
  Users,
  Grid3X3,
  ArrowLeft,
  MapPin,
} from 'lucide-react';
import { useCharacterTrackingStore, CharacterTrackingData, SceneInfo } from '../../store/characterTrackingStore';
import { useNavigationStore } from '../../store/navigationStore';

const STATUS_CONFIG = {
  alive: { color: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Alive' },
  dead: { color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Dead' },
  missing: { color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Missing' },
};

type TabId = 'dashboard' | 'characters' | 'matrix';

// ===== CHARACTER DETAIL VIEW =====
interface CharacterDetailViewProps {
  character: CharacterTrackingData;
  chapters: { id: string; title: string }[];
  scenes: SceneInfo[];
  onBack: () => void;
  onSceneClick: (sceneId: string) => void;
}

const CharacterDetailView: React.FC<CharacterDetailViewProps> = ({
  character,
  chapters,
  scenes,
  onBack,
  onSceneClick,
}) => {
  const status = STATUS_CONFIG[character.characterStatus] || STATUS_CONFIG.alive;

  // Group scenes by chapter
  const scenesByChapter = useMemo(() => {
    const groups = new Map<string, SceneInfo[]>();
    for (const scene of scenes) {
      const chapterId = scene.parentId;
      const existing = groups.get(chapterId) || [];
      existing.push(scene);
      groups.set(chapterId, existing);
    }
    return groups;
  }, [scenes]);

  // Get chapter number
  const getChapterNumber = (chapterId: string): number => {
    const idx = chapters.findIndex((c) => c.id === chapterId);
    return idx + 1;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-violet-400" />
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-bg-secondary)]"
              style={{ backgroundColor: status.color }}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {character.characterName}
            </h2>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <p className="text-3xl font-bold text-violet-400">{character.totalAppearances}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Total Appearances</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <p className="text-3xl font-bold text-emerald-400">{character.appearancePercentage.toFixed(0)}%</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Chapter Coverage</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center">
            <p className="text-3xl font-bold text-amber-400">
              {character.lastChapterIndex >= 0 ? character.lastChapterIndex + 1 : '-'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Last Seen Chapter</p>
          </div>
        </div>

        {/* Chapter Presence Timeline */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Chapter Presence
          </h3>
          <div className="flex flex-wrap gap-2">
            {chapters.map((chapter, idx) => {
              const hasAppearance = character.chapterIds.includes(chapter.id);
              return (
                <div
                  key={chapter.id}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg text-xs font-medium transition-all ${
                    hasAppearance
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'bg-[var(--color-bg-tertiary)] text-slate-600 border border-[var(--color-border)]'
                  }`}
                  title={chapter.title || `Chapter ${idx + 1}`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenes by Chapter */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Scenes ({scenes.length})
          </h3>

          {scenes.length > 0 ? (
            <div className="space-y-6">
              {Array.from(scenesByChapter.entries()).map(([chapterId, chapterScenes]) => {
                const chapter = chapters.find((c) => c.id === chapterId);
                const chapterNum = getChapterNumber(chapterId);
                return (
                  <div key={chapterId}>
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: status.color + '20', color: status.color }}
                      >
                        {chapterNum}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {chapter?.title || `Chapter ${chapterNum}`}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {chapterScenes.length} scene{chapterScenes.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 space-y-1.5 border-l-2 border-[var(--color-border)] pl-4">
                      {chapterScenes.map((scene) => (
                        <button
                          key={scene.id}
                          onClick={() => onSceneClick(scene.id)}
                          className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all group"
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
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
              <Ghost className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">No scenes found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== MAIN COMPONENT =====
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
  const [detailCharacter, setDetailCharacter] = useState<CharacterTrackingData | null>(null);

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
        setDetailCharacter(char);
      }
    } else {
      setCharacterScenes([]);
      setDetailCharacter(null);
    }
  }, [selectedCharacterId, trackingData, getScenesForCharacter]);

  const insights = useMemo(() => getInsights(), [getInsights]);

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

  const handleBackToList = () => {
    setDetailCharacter(null);
    selectCharacter(null);
  };

  const totalChapters = chapters.length;
  const activeCharacters = trackingData.filter((c) => c.totalAppearances > 0 && c.characterStatus === 'alive').length;

  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'characters', label: 'Characters', icon: <Users className="w-4 h-4" /> },
    { id: 'matrix', label: 'Chapter Matrix', icon: <Grid3X3 className="w-4 h-4" /> },
  ];

  // Show character detail view when a character is selected
  if (detailCharacter) {
    return (
      <div className="flex h-full bg-[var(--color-bg-primary)]">
        <CharacterDetailView
          character={detailCharacter}
          chapters={chapters}
          scenes={characterScenes}
          onBack={handleBackToList}
          onSceneClick={handleSceneClick}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[var(--color-bg-primary)]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)]">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Character Tracking
                </h1>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Monitor character presence
                </p>
              </div>
            </div>
            <button
              onClick={() => rebuildTracking()}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 p-1 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-sm ${
                  activeTab === tab.id
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <div className="p-6 space-y-6">
              {/* Stats - Compact Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{trackingData.length}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Characters</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{activeCharacters}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Active</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{totalChapters}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Chapters</p>
                  </div>
                </div>
              </div>

              {/* Insights - Compact Grid */}
              {insights.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Writing Insights
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {insights.slice(0, 6).map((insight, idx) => (
                      <div
                        key={`${insight.characterId}-${idx}`}
                        className={`flex items-start gap-3 px-4 py-3 rounded-lg ${
                          insight.type === 'warning'
                            ? 'bg-amber-500/10 border border-amber-500/20'
                            : 'bg-blue-500/10 border border-blue-500/20'
                        }`}
                      >
                        {insight.type === 'warning' ? (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`text-xs ${insight.type === 'warning' ? 'text-amber-200' : 'text-blue-200'}`}>
                            {insight.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Overview - Inline Badges */}
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-muted)] mb-3">Character Status</h2>
                <div className="flex items-center gap-3">
                  {(['alive', 'dead', 'missing'] as const).map((status) => {
                    const config = STATUS_CONFIG[status];
                    const count = trackingData.filter((c) => c.characterStatus === status).length;
                    return (
                      <div
                        key={status}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                        <span className={`text-sm font-medium ${config.text}`}>{count}</span>
                        <span className={`text-xs ${config.text} opacity-70`}>{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===== CHARACTERS TAB ===== */}
          {activeTab === 'characters' && (
            <div className="p-6">
              {/* Search - Inline */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm"
                  />
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {filteredCharacters.length} characters
                </span>
              </div>

              {/* Character List - Compact */}
              {filteredCharacters.length > 0 ? (
                <div className="space-y-2">
                  {filteredCharacters.map((char) => {
                    const status = STATUS_CONFIG[char.characterStatus] || STATUS_CONFIG.alive;

                    return (
                      <button
                        key={char.characterId}
                        onClick={() => handleCharacterClick(char.characterId)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-violet-500/30 hover:bg-[var(--color-bg-secondary)]/80 transition-all text-left group"
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-violet-400" />
                          </div>
                          <div
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-bg-secondary)]"
                            style={{ backgroundColor: status.color }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              {char.characterName}
                            </h3>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${status.bg} ${status.text}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                          <div className="text-right">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">{char.totalAppearances}</span>
                            <span className="ml-1">scenes</span>
                          </div>
                          <div className="w-16 h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${char.appearancePercentage}%`, backgroundColor: status.color }}
                            />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-primary)] w-10 text-right">
                            {char.appearancePercentage.toFixed(0)}%
                          </span>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
                    <User className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">
                    No characters yet
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Create characters in the Universe panel
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ===== MATRIX TAB ===== */}
          {activeTab === 'matrix' && (
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Chapter Distribution
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Character appearances across chapters
                </p>
              </div>

              {chapters.length > 0 && filteredCharacters.length > 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                      <thead>
                        <tr className="border-b border-[var(--color-border)]">
                          <th className="text-left text-xs font-medium text-[var(--color-text-muted)] px-4 py-3 sticky left-0 bg-[var(--color-bg-secondary)]/90 z-10">
                            Character
                          </th>
                          {chapters.map((chapter, idx) => (
                            <th
                              key={chapter.id}
                              className="text-center text-xs font-medium text-[var(--color-text-muted)] px-2 py-3 min-w-[32px]"
                            >
                              <span className="text-sm font-semibold">{idx + 1}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCharacters.map((char) => {
                          const status = STATUS_CONFIG[char.characterStatus] || STATUS_CONFIG.alive;
                          return (
                            <tr
                              key={char.characterId}
                              className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]/30 transition-colors"
                            >
                              <td className="px-4 py-2.5 sticky left-0 bg-[var(--color-bg-secondary)]/90 z-10">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: status.color }}
                                  />
                                  <span className="text-xs font-medium text-[var(--color-text-primary)] truncate max-w-[120px]">
                                    {char.characterName}
                                  </span>
                                </div>
                              </td>
                              {chapters.map((chapter) => {
                                const hasAppearance = char.chapterIds.includes(chapter.id);
                                return (
                                  <td key={chapter.id} className="px-2 py-2.5 text-center">
                                    {hasAppearance ? (
                                      <div
                                        className="w-4 h-4 rounded-full mx-auto"
                                        style={{ backgroundColor: status.color }}
                                      />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border border-slate-700 mx-auto opacity-20" />
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
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
                    <Grid3X3 className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-base font-medium text-[var(--color-text-primary)] mb-1">
                    No data available
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Add chapters and characters
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
