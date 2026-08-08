import { create } from 'zustand';

export type ActiveView = 'manuscript' | 'universe' | 'timeline' | 'calendars' | 'about' | 'versioning' | 'settings' | 'import' | 'export' | 'search';

interface NavigationState {
  activeView: ActiveView;
  activeSceneId: string | null;
  selectedNodeId: string | null;
  // Universe navigation
  selectedUniverseCategoryId: string | null;
  selectedUniverseEntryId: string | null;

  setActiveView: (view: ActiveView) => void;
  setActiveSceneId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedUniverse: (categoryId: string | null, entryId: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'manuscript',
  activeSceneId: null,
  selectedNodeId: null,
  selectedUniverseCategoryId: null,
  selectedUniverseEntryId: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveSceneId: (id) => set({ activeSceneId: id }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedUniverse: (categoryId, entryId) =>
    set({ selectedUniverseCategoryId: categoryId, selectedUniverseEntryId: entryId }),
}));
