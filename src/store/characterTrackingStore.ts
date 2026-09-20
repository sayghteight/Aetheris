import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface CharacterTrackingData {
  characterId: string;
  characterName: string;
  characterStatus: 'alive' | 'dead' | 'missing';
  totalAppearances: number;
  chapterIds: string[];
  sceneIds: string[];
  firstChapterIndex: number;
  lastChapterIndex: number;
  firstAppearance: string | null;
  lastAppearance: string | null;
  appearancePercentage: number;
}

export interface ChapterInfo {
  id: string;
  title: string;
  sortOrder: number;
  partId: string | null;
}

export interface SceneInfo {
  id: string;
  title: string;
  sortOrder: number;
  parentId: string;
}

export interface WritingInsight {
  type: 'warning' | 'info';
  message: string;
  characterId: string;
  characterName: string;
}

interface CharacterTrackingState {
  trackingData: CharacterTrackingData[];
  chapters: ChapterInfo[];
  isLoading: boolean;
  error: string | null;
  selectedCharacterId: string | null;
  searchQuery: string;
  filterChapter: string | null;
  filterPart: string | null;
  filterScene: string | null;

  // Actions
  loadTrackingData: () => Promise<void>;
  rebuildTracking: () => Promise<void>;
  selectCharacter: (characterId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterChapter: (chapterId: string | null) => void;
  setFilterPart: (partId: string | null) => void;
  setFilterScene: (sceneId: string | null) => void;
  getScenesForCharacter: (characterId: string) => Promise<SceneInfo[]>;
  getInsights: () => WritingInsight[];
}

export const useCharacterTrackingStore = create<CharacterTrackingState>((set, get) => ({
  trackingData: [],
  chapters: [],
  isLoading: false,
  error: null,
  selectedCharacterId: null,
  searchQuery: '',
  filterChapter: null,
  filterPart: null,
  filterScene: null,

  loadTrackingData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [trackingData, chapters] = await Promise.all([
        invoke<any[]>('get_character_tracking'),
        invoke<any[]>('get_chapters_info'),
      ]);

      // Transform data to camelCase
      const transformedTracking: CharacterTrackingData[] = trackingData.map((t) => ({
        characterId: t.character_id,
        characterName: t.character_name,
        characterStatus: t.character_status || 'alive',
        totalAppearances: t.total_appearances,
        chapterIds: t.chapter_ids,
        sceneIds: t.scene_ids,
        firstChapterIndex: t.first_chapter_index,
        lastChapterIndex: t.last_chapter_index,
        firstAppearance: t.first_appearance,
        lastAppearance: t.last_appearance,
        appearancePercentage: t.appearance_percentage,
      }));

      const transformedChapters: ChapterInfo[] = chapters.map((c: any) => ({
        id: c.id,
        title: c.title,
        sortOrder: c.sort_order,
        partId: c.part_id,
      }));

      set({
        trackingData: transformedTracking,
        chapters: transformedChapters,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e.message || 'Error loading tracking data', isLoading: false });
    }
  },

  rebuildTracking: async () => {
    set({ isLoading: true, error: null });
    try {
      const trackingData = await invoke<any[]>('rebuild_character_tracking');

      const transformedTracking: CharacterTrackingData[] = trackingData.map((t: any) => ({
        characterId: t.character_id,
        characterName: t.character_name,
        characterStatus: t.character_status || 'alive',
        totalAppearances: t.total_appearances,
        chapterIds: t.chapter_ids,
        sceneIds: t.scene_ids,
        firstChapterIndex: t.first_chapter_index,
        lastChapterIndex: t.last_chapter_index,
        firstAppearance: t.first_appearance,
        lastAppearance: t.last_appearance,
        appearancePercentage: t.appearance_percentage,
      }));

      set({ trackingData: transformedTracking, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Error rebuilding tracking', isLoading: false });
    }
  },

  selectCharacter: (characterId) => set({ selectedCharacterId: characterId }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilterChapter: (chapterId) => set({ filterChapter: chapterId }),

  setFilterPart: (partId) => set({ filterPart: partId }),

  setFilterScene: (sceneId) => set({ filterScene: sceneId }),

  getScenesForCharacter: async (characterId) => {
    try {
      const scenes = await invoke<any[]>('get_scenes_for_character', { characterId });
      return scenes.map((s: any) => ({
        id: s.id,
        title: s.title,
        sortOrder: s.sort_order,
        parentId: s.parent_id,
      }));
    } catch (e) {
      console.error('Error getting scenes for character:', e);
      return [];
    }
  },

  getInsights: () => {
    const { trackingData, chapters } = get();
    const insights: WritingInsight[] = [];
    const totalChapters = chapters.length;

    if (totalChapters === 0) return insights;

    const sortedByLastAppearance = [...trackingData]
      .filter((t) => t.totalAppearances > 0)
      .sort((a, b) => (a.lastChapterIndex || 0) - (b.lastChapterIndex || 0));

    const lastChapterOverall = sortedByLastAppearance.length > 0
      ? Math.max(...sortedByLastAppearance.map((t) => t.lastChapterIndex || 0))
      : 0;

    for (const char of trackingData) {
      // Skip characters that are dead or missing - their absence is expected
      if (char.characterStatus === 'dead' || char.characterStatus === 'missing') {
        continue;
      }

      if (char.totalAppearances === 0) {
        insights.push({
          type: 'info',
          message: `${char.characterName} has not appeared yet.`,
          characterId: char.characterId,
          characterName: char.characterName,
        });
        continue;
      }

      const chaptersSinceLastAppearance = lastChapterOverall - (char.lastChapterIndex || 0);
      if (chaptersSinceLastAppearance >= 4) {
        insights.push({
          type: 'warning',
          message: `${char.characterName} has not appeared for ${chaptersSinceLastAppearance} chapters.`,
          characterId: char.characterId,
          characterName: char.characterName,
        });
      }

      if (char.totalAppearances === 1 && chaptersSinceLastAppearance <= 2) {
        insights.push({
          type: 'info',
          message: `${char.characterName} was introduced ${chaptersSinceLastAppearance} chapter(s) ago.`,
          characterId: char.characterId,
          characterName: char.characterName,
        });
      }

      if (char.appearancePercentage >= 50 && char.totalAppearances > 1) {
        insights.push({
          type: 'info',
          message: `${char.characterName} appears in ${char.appearancePercentage.toFixed(0)}% of the manuscript's chapters.`,
          characterId: char.characterId,
          characterName: char.characterName,
        });
      }
    }

    return insights.slice(0, 10);
  },
}));
