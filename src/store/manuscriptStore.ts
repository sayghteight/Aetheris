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
  created_at: string | null;
  updated_at: string | null;
}

interface ManuscriptState {
  nodes: ManuscriptNode[];
  isLoading: boolean;
  error: string | null;

  fetchNodes: () => Promise<void>;
  createNode: (parentId: string | null, title: string, nodeType: 'part' | 'chapter' | 'scene' | 'folder') => Promise<ManuscriptNode>;
}

export const useManuscriptStore = create<ManuscriptState>((set) => ({
  nodes: [],
  isLoading: false,
  error: null,

  fetchNodes: async () => {
    set({ isLoading: true, error: null });
    try {
      const nodes = await invoke<ManuscriptNode[]>('get_manuscript_nodes');
      set({ nodes, isLoading: false });
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
}));
