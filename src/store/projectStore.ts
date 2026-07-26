import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ProjectMetadata {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  genre: string | null;
  synopsis: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RecentProject {
  path: string;
  title: string;
  author: string | null;
  genre: string | null;
  last_opened: string;
}

interface ProjectState {
  currentProject: ProjectMetadata | null;
  activePath: string | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  recentProjects: RecentProject[];

  createProject: (path: string, title: string, author: string, genre?: string, synopsis?: string) => Promise<ProjectMetadata>;
  openProject: (path: string) => Promise<ProjectMetadata>;
  closeProject: () => Promise<void>;
  clearError: () => void;
  loadRecentProjects: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  activePath: null,
  isOpen: false,
  isLoading: false,
  error: null,
  recentProjects: [],

  createProject: async (path: string, title: string, author: string, genre?: string, synopsis?: string) => {
    set({ isLoading: true, error: null });
    try {
      const metadata = await invoke<ProjectMetadata>('create_project', { path, title, author, genre: genre || null, synopsis: synopsis || null });
      await invoke('add_recent_project', { path, title, author, genre: genre || null });
      set({ currentProject: metadata, activePath: path, isOpen: true, isLoading: false });
      get().loadRecentProjects();
      return metadata;
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al crear el proyecto';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  openProject: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const metadata = await invoke<ProjectMetadata>('open_project', { path });
      await invoke('add_recent_project', { path, title: metadata.title, author: metadata.author, genre: metadata.genre });
      set({ currentProject: metadata, activePath: path, isOpen: true, isLoading: false });
      get().loadRecentProjects();
      return metadata;
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al abrir el proyecto';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  closeProject: async () => {
    set({ isLoading: true, error: null });
    try {
      // Save workspace state before closing
      await import('./workspaceStore').then(m => m.useWorkspaceStore.getState().saveWorkspaceState());
      await invoke('close_project');
      set({ currentProject: null, activePath: null, isOpen: false, isLoading: false });
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : e.message || 'Error al cerrar el proyecto';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  clearError: () => set({ error: null }),

  loadRecentProjects: async () => {
    try {
      const projects = await invoke<RecentProject[]>('get_recent_projects');
      set({ recentProjects: projects });
    } catch (e) {
      console.error('Error loading recent projects:', e);
    }
  },
}));
