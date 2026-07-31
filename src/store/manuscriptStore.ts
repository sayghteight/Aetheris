import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ManuscriptNode {
  id: string;
  parent_id: string | null;
  title: string;
  type: 'part' | 'chapter' | 'scene' | 'folder';
  sort_order: number;
  status: 'draft' | 'review' | 'final';
  color: string | null;
  tags: string | null;
  synopsis: string | null;
  writing_goals: string | null;
  author_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ManuscriptState {
  nodes: ManuscriptNode[];
  isLoading: boolean;
  error: string | null;
  // Undo history
  history: ManuscriptNode[][];
  historyIndex: number;

  fetchNodes: () => Promise<void>;
  createNode: (parentId: string | null, title: string, nodeType: 'part' | 'chapter' | 'scene' | 'folder') => Promise<ManuscriptNode>;
  updateNode: (id: string, updates: Partial<ManuscriptNode>) => Promise<ManuscriptNode>;
  deleteNode: (id: string) => Promise<void>;
  mergeScenes: (sourceIds: string[], targetId: string) => Promise<ManuscriptNode>;
  splitSceneAtCursor: (nodeId: string, cursorPosition: number) => Promise<ManuscriptNode[]>;
  splitSceneBySelection: (nodeId: string, start: number, end: number) => Promise<ManuscriptNode[]>;
  undo: () => void;
  pushHistory: () => void;
}

export const useManuscriptStore = create<ManuscriptState>((set, get) => ({
  nodes: [],
  isLoading: false,
  error: null,
  history: [],
  historyIndex: -1,

  pushHistory: () => {
    const { nodes, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(nodes)));
    // Keep max 50 history entries
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      set({ nodes: prevState, historyIndex: historyIndex - 1 });
    }
  },

  fetchNodes: async () => {
    set({ isLoading: true, error: null });
    try {
      const nodes = await invoke<ManuscriptNode[]>('get_manuscript_nodes');
      set({ nodes, isLoading: false, history: [nodes], historyIndex: 0 });
    } catch (e: any) {
      set({ error: e.message || 'Error al obtener nodos', isLoading: false });
    }
  },

  createNode: async (parentId: string | null, title: string, nodeType: 'part' | 'chapter' | 'scene' | 'folder') => {
    set({ isLoading: true, error: null });
    try {
      const newNode = await invoke<ManuscriptNode>('create_manuscript_node', {
        parentId,
        title,
        nodeType,
      });
      set((state) => ({
        nodes: [...state.nodes, newNode].sort((a, b) => a.sort_order - b.sort_order),
        isLoading: false,
      }));
      return newNode;
    } catch (e: any) {
      const errMsg = e.message || 'Error al crear nodo';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  updateNode: async (id: string, updates: Partial<ManuscriptNode>) => {
    const node = await invoke<ManuscriptNode>('update_manuscript_node', {
      id,
      title: updates.title ?? '',
      status: updates.status ?? 'draft',
      color: updates.color ?? null,
      tags: updates.tags ?? null,
      synopsis: updates.synopsis ?? null,
      writingGoals: updates.writing_goals ?? null,
      authorNotes: updates.author_notes ?? null,
    });
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? node : n)),
    }));
    return node;
  },

  deleteNode: async (id: string) => {
    await invoke('delete_manuscript_node', { id });
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
    }));
  },

  mergeScenes: async (sourceIds: string[], targetId: string) => {
    set({ isLoading: true, error: null });
    get().pushHistory();
    try {
      const updatedTarget = await invoke<ManuscriptNode>('merge_scenes', {
        sourceIds,
        targetId,
      });
      // Refresh nodes to get accurate state after merge
      const nodes = await invoke<ManuscriptNode[]>('get_manuscript_nodes');
      set({ nodes, isLoading: false });
      return updatedTarget;
    } catch (e: any) {
      const errMsg = e.message || 'Error al fusionar escenas';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  splitSceneAtCursor: async (nodeId: string, cursorPosition: number) => {
    set({ isLoading: true, error: null });
    get().pushHistory();
    try {
      const newNodes = await invoke<ManuscriptNode[]>('split_scene_at_cursor', {
        nodeId,
        cursorPosition,
      });
      // Refresh nodes
      const nodes = await invoke<ManuscriptNode[]>('get_manuscript_nodes');
      set({ nodes, isLoading: false });
      return newNodes;
    } catch (e: any) {
      const errMsg = e.message || 'Error al dividir escena';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },

  splitSceneBySelection: async (nodeId: string, start: number, end: number) => {
    set({ isLoading: true, error: null });
    get().pushHistory();
    try {
      const newNodes = await invoke<ManuscriptNode[]>('split_scene_by_selection', {
        nodeId,
        start,
        end,
      });
      // Refresh nodes
      const nodes = await invoke<ManuscriptNode[]>('get_manuscript_nodes');
      set({ nodes, isLoading: false });
      return newNodes;
    } catch (e: any) {
      const errMsg = e.message || 'Error al dividir escena';
      set({ error: errMsg, isLoading: false });
      throw new Error(errMsg);
    }
  },
}));
