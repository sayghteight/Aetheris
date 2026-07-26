import { create } from 'zustand';

export type ActiveView = 'manuscript' | 'universe' | 'timeline' | 'calendars' | 'versioning' | 'settings' | 'import';

interface NavigationState {
  activeView: ActiveView;
  activeSceneId: string | null;

  setActiveView: (view: ActiveView) => void;
  setActiveSceneId: (id: string | null) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'manuscript',
  activeSceneId: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveSceneId: (id) => set({ activeSceneId: id }),
}));
