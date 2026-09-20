import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigationStore } from '../../store/navigationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  User,
  MapPin,
  Users,
  Gem,
  Calendar,
  ArrowRightLeft,
  ExternalLink,
  BookOpen,
  Clock,
  Shield,
  Swords,
  X,
  Loader2,
} from 'lucide-react';

// Types matching the Rust backend
interface LoreEntity {
  id: string;
  name: string;
  entryType: string;
  briefDescription: string | null;
  categoryName: string;
}

interface LoreRelation {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  relationType: string;
}

interface EntityAppearance {
  chapterTitle: string;
  sceneTitle: string;
  sceneId: string;
}

interface LoreForScene {
  characters: LoreEntity[];
  locations: LoreEntity[];
  factions: LoreEntity[];
  items: LoreEntity[];
  events: LoreEntity[];
  relations: LoreRelation[];
  previousAppearances: Record<string, EntityAppearance[]>;
}

type TabType = 'context' | 'history';

const ENTITY_COLORS: Record<string, string> = {
  character: 'from-violet-500 to-purple-600',
  race: 'from-violet-500 to-purple-600',
  location: 'from-emerald-500 to-teal-600',
  faction: 'from-amber-500 to-orange-600',
  organization: 'from-amber-500 to-orange-600',
  kingdom: 'from-amber-500 to-orange-600',
  item: 'from-rose-500 to-pink-600',
  event: 'from-indigo-500 to-blue-600',
};

const ENTITY_BG_COLORS: Record<string, string> = {
  character: 'bg-violet-500/10 text-violet-400',
  race: 'bg-violet-500/10 text-violet-400',
  location: 'bg-emerald-500/10 text-emerald-400',
  faction: 'bg-amber-500/10 text-amber-400',
  organization: 'bg-amber-500/10 text-amber-400',
  kingdom: 'bg-amber-500/10 text-amber-400',
  item: 'bg-rose-500/10 text-rose-400',
  event: 'bg-indigo-500/10 text-indigo-400',
};

interface EntitySectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  entities: LoreEntity[];
  onSelect: (entity: LoreEntity) => void;
  selectedId: string | null;
}

const EntitySection: React.FC<EntitySectionProps> = ({ title, icon: Icon, entities, onSelect, selectedId }) => {
  const [expanded, setExpanded] = useState(true);

  if (entities.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-150"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${ENTITY_BG_COLORS[entities[0]?.entryType] || 'bg-slate-500/10 text-slate-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-[var(--color-text-primary)]">{title}</span>
        <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded-full">
          {entities.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 ml-4 pl-4 border-l-2 border-[var(--color-border)] space-y-1.5">
          {entities.map((entity) => {
            const colorClass = ENTITY_COLORS[entity.entryType] || 'from-slate-500 to-slate-600';
            const isSelected = selectedId === entity.id;

            return (
              <button
                key={entity.id}
                onClick={() => onSelect(entity)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${
                  isSelected
                    ? 'bg-violet-500/10 border border-violet-500/40'
                    : 'bg-[var(--color-bg-secondary)]/50 border border-transparent hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border)]'
                }`}
              >
                {/* Entity thumbnail */}
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
                  {entity.name.charAt(0).toUpperCase()}
                </div>

                {/* Entity info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium text-[var(--color-text-primary)] ${isSelected ? 'text-violet-300' : ''}`}>
                      {entity.name}
                    </span>
                    {/* Worldbuilding link indicator */}
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-500 opacity-60" title="Linked to Worldbuilding" />
                  </div>
                  {entity.briefDescription && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                      {entity.briefDescription}
                    </p>
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight className={`w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100 text-violet-400' : ''}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface LoreMasterPanelProps {
  onOpenInWorldbuilding?: (entityId: string) => void;
}

export const LoreMasterPanel: React.FC<LoreMasterPanelProps> = ({ onOpenInWorldbuilding }) => {
  const { activeSceneId } = useNavigationStore();
  const { setRightPanelExpanded } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<TabType>('context');
  const [loreData, setLoreData] = useState<LoreForScene | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<LoreEntity | null>(null);

  // Fetch lore data when scene changes
  useEffect(() => {
    if (!activeSceneId) {
      setLoreData(null);
      setSelectedEntity(null);
      return;
    }

    const fetchLore = async () => {
      setIsLoading(true);
      try {
        const data = await invoke<LoreForScene>('get_lore_for_scene', { sceneId: activeSceneId });
        console.log('[LoreMaster] Received data:', JSON.stringify(data, null, 2));
        setLoreData(data);
        // Auto-select first character if available
        if (data.characters.length > 0) {
          setSelectedEntity(data.characters[0]);
        } else if (data.locations.length > 0) {
          setSelectedEntity(data.locations[0]);
        } else if (data.items.length > 0) {
          setSelectedEntity(data.items[0]);
        }
      } catch (e) {
        console.error('Error fetching lore for scene:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLore();
  }, [activeSceneId]);

  const handleEntitySelect = useCallback((entity: LoreEntity) => {
    setSelectedEntity(entity);
  }, []);

  const handleOpenInWorldbuilding = () => {
    if (selectedEntity && onOpenInWorldbuilding) {
      onOpenInWorldbuilding(selectedEntity.id);
    }
  };

  const totalEntities = loreData
    ? loreData.characters.length +
      loreData.locations.length +
      loreData.factions.length +
      loreData.items.length +
      loreData.events.length
    : 0;

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Lore Master</h2>
          </div>
          <button
            onClick={() => setRightPanelExpanded(false)}
            className="ml-auto p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] italic">"Everything connected to this scene."</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-4">
        {(['context', 'history', 'consistency'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 ${
              activeTab === tab
                ? 'bg-violet-500/15 text-violet-400 shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          </div>
        ) : !activeSceneId ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">Select a scene to see its lore</p>
          </div>
        ) : loreData && totalEntities === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">No entities detected in this scene</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Add character or location names to your text</p>
          </div>
        ) : (
          <>
            {activeTab === 'context' && loreData && (
              <>
                {/* Entity Sections */}
                <EntitySection
                  title="Characters"
                  icon={User}
                  entities={loreData.characters}
                  onSelect={handleEntitySelect}
                  selectedId={selectedEntity?.id || null}
                />
                <EntitySection
                  title="Locations"
                  icon={MapPin}
                  entities={loreData.locations}
                  onSelect={handleEntitySelect}
                  selectedId={selectedEntity?.id || null}
                />
                <EntitySection
                  title="Factions"
                  icon={Users}
                  entities={loreData.factions}
                  onSelect={handleEntitySelect}
                  selectedId={selectedEntity?.id || null}
                />
                <EntitySection
                  title="Objects"
                  icon={Gem}
                  entities={loreData.items}
                  onSelect={handleEntitySelect}
                  selectedId={selectedEntity?.id || null}
                />
                <EntitySection
                  title="Events"
                  icon={Calendar}
                  entities={loreData.events}
                  onSelect={handleEntitySelect}
                  selectedId={selectedEntity?.id || null}
                />

                {/* Selected Entity Detail */}
                {selectedEntity && (
                  <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${ENTITY_COLORS[selectedEntity.entryType] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white font-bold text-lg`}>
                        {selectedEntity.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[var(--color-text-primary)]">{selectedEntity.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ENTITY_BG_COLORS[selectedEntity.entryType] || 'bg-slate-500/10 text-slate-400'}`}>
                          {selectedEntity.categoryName}
                        </span>
                      </div>
                    </div>

                    {/* Quick lore info */}
                    <div className="space-y-2 text-sm">
                      {selectedEntity.entryType === 'character' && (
                        <>
                          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                            <Shield className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <span>Faction: <span className="text-[var(--color-text-primary)]">{selectedEntity.categoryName}</span></span>
                          </div>
                          {loreData.previousAppearances[selectedEntity.id] && (
                            <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                              <span>Last: <span className="text-[var(--color-text-primary)]">Chapter 3, Scene 2</span></span>
                            </div>
                          )}
                        </>
                      )}
                      {selectedEntity.entryType === 'item' && (
                        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                          <Swords className="w-4 h-4 text-[var(--color-text-muted)]" />
                          <span>Type: <span className="text-[var(--color-text-primary)]">Weapon</span></span>
                        </div>
                      )}
                      {selectedEntity.briefDescription && (
                        <p className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)]">
                          {selectedEntity.briefDescription}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleOpenInWorldbuilding}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-violet-400 text-sm font-medium hover:bg-violet-500/10 hover:border-violet-500/30 transition-all duration-150"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Worldbuilding
                    </button>
                  </div>
                )}

                {/* Relationships */}
                {loreData.relations.length > 0 && (
                  <div className="mt-6 p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4" />
                      Relationships
                    </h4>
                    <div className="space-y-2">
                      {loreData.relations.map((rel, idx) => (
                        <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{rel.sourceName}</span>
                          <span className="text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">{rel.relationType}</span>
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{rel.targetName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && loreData && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Previous appearances
                </h4>
                {Object.entries(loreData.previousAppearances).map(([entityId, appearances]) => {
                  const entity = loreData.characters.find(c => c.id === entityId) ||
                    loreData.locations.find(l => l.id === entityId) ||
                    loreData.items.find(i => i.id === entityId);
                  if (!entity || appearances.length === 0) return null;

                  return (
                    <div key={entityId} className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                      <h5 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">{entity.name}</h5>
                      <div className="space-y-1">
                        {appearances.map((app, idx) => (
                          <button
                            key={idx}
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-violet-400 transition-colors"
                          >
                            <ChevronRight className="w-3 h-3" />
                            <span className="text-xs">{app.chapterTitle}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">·</span>
                            <span className="text-xs">{app.sceneTitle}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(loreData.previousAppearances).length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
                    No previous appearances found
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{totalEntities} entities linked</span>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] italic">Updates as you write</span>
      </div>
    </div>
  );
};

export default LoreMasterPanel;
