import { create } from 'zustand';

export type ActiveView = 'manuscript' | 'universe' | 'timeline' | 'calendars' | 'versioning' | 'settings' | 'import';

interface NavigationState {
  activeView: ActiveView;
  activeSceneId: string | null;
  sidebarExpanded: boolean;
  rightPanelExpanded: boolean;

  setActiveView: (view: ActiveView) => void;
  setActiveSceneId: (id: string | null) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeView: 'manuscript',
  activeSceneId: null,
  sidebarExpanded: false,
  rightPanelExpanded: false,

  setActiveView: (view) => set({ activeView: view, sidebarExpanded: view === 'manuscript' ? true : false, rightPanelExpanded: view === 'manuscript' ? true : false }),
  setActiveSceneId: (id) => set({ activeSceneId: id }),
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  toggleRightPanel: () => set((state) => ({ rightPanelExpanded: !state.rightPanelExpanded })),
}));
