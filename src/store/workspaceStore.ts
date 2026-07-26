import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ActiveView, useNavigationStore } from './navigationStore';

export interface WorkspaceState {
  sidebarExpanded: boolean;
  rightPanelExpanded: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  activeView: ActiveView;
  activeSceneId: string | null;
  expandedNodeIds: string[];
  treeScrollPosition: number;
  editorScrollPosition: number;
  isLoaded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  setRightPanelExpanded: (expanded: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setActiveView: (view: ActiveView) => void;
  setActiveSceneId: (id: string | null) => void;
  setExpandedNodeIds: (ids: string[]) => void;
  setTreeScrollPosition: (pos: number) => void;
  setEditorScrollPosition: (pos: number) => void;
  loadWorkspaceState: () => Promise<void>;
  saveWorkspaceState: () => Promise<void>;
}

interface RustWorkspaceState {
  sidebar_expanded: boolean;
  right_panel_expanded: boolean;
  sidebar_width: number;
  right_panel_width: number;
  active_view: string;
  active_scene_id: string | null;
  expanded_node_ids: string[];
  tree_scroll_position: number;
  editor_scroll_position: number;
}

const DEBOUNCE_MS = 500;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export const scheduleWorkspaceSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    useWorkspaceStore.getState().saveWorkspaceState();
  }, DEBOUNCE_MS);
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sidebarExpanded: true,
  rightPanelExpanded: true,
  sidebarWidth: 256,
  rightPanelWidth: 320,
  activeView: 'manuscript',
  activeSceneId: null,
  expandedNodeIds: [],
  treeScrollPosition: 0,
  editorScrollPosition: 0,
  isLoaded: false,

  setSidebarExpanded: (expanded) => {
    set({ sidebarExpanded: expanded });
    scheduleWorkspaceSave();
  },
  setRightPanelExpanded: (expanded) => {
    set({ rightPanelExpanded: expanded });
    scheduleWorkspaceSave();
  },
  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
    scheduleWorkspaceSave();
  },
  setRightPanelWidth: (width) => {
    set({ rightPanelWidth: width });
    scheduleWorkspaceSave();
  },
  setActiveView: (view) => {
    set({ activeView: view });
    useNavigationStore.getState().setActiveView(view);
    scheduleWorkspaceSave();
  },
  setActiveSceneId: (id) => {
    set({ activeSceneId: id });
    useNavigationStore.getState().setActiveSceneId(id);
    scheduleWorkspaceSave();
  },
  setExpandedNodeIds: (ids) => {
    set({ expandedNodeIds: ids });
    scheduleWorkspaceSave();
  },
  setTreeScrollPosition: (pos) => set({ treeScrollPosition: pos }),
  setEditorScrollPosition: (pos) => set({ editorScrollPosition: pos }),

  loadWorkspaceState: async () => {
    try {
      const state = await invoke<RustWorkspaceState>('get_workspace_state');
      set({
        sidebarExpanded: state.sidebar_expanded,
        rightPanelExpanded: state.right_panel_expanded,
        sidebarWidth: state.sidebar_width,
        rightPanelWidth: state.right_panel_width,
        activeView: state.active_view as ActiveView,
        activeSceneId: state.active_scene_id,
        expandedNodeIds: state.expanded_node_ids,
        treeScrollPosition: state.tree_scroll_position,
        editorScrollPosition: state.editor_scroll_position,
        isLoaded: true,
      });
      // Sync navigation store with loaded state
      useNavigationStore.getState().setActiveView(state.active_view as ActiveView);
      if (state.active_scene_id) {
        useNavigationStore.getState().setActiveSceneId(state.active_scene_id);
      }
    } catch (e) {
      console.error('Error loading workspace state:', e);
      set({ isLoaded: true });
    }
  },

  saveWorkspaceState: async () => {
    try {
      const {
        sidebarExpanded,
        rightPanelExpanded,
        sidebarWidth,
        rightPanelWidth,
        activeView,
        activeSceneId,
        expandedNodeIds,
        treeScrollPosition,
        editorScrollPosition,
      } = get();
      await invoke('save_workspace_state', {
        data: {
          sidebar_expanded: sidebarExpanded,
          right_panel_expanded: rightPanelExpanded,
          sidebar_width: sidebarWidth,
          right_panel_width: rightPanelWidth,
          active_view: activeView,
          active_scene_id: activeSceneId,
          expanded_node_ids: expandedNodeIds,
          tree_scroll_position: treeScrollPosition,
          editor_scroll_position: editorScrollPosition,
        },
      });
    } catch (e) {
      console.error('Error saving workspace state:', e);
    }
  },
}));
