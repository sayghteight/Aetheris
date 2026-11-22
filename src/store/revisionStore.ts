import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

/**
 * Revision de una escena: una copia inmutable del contenido tal y como estaba
 * en el momento de guardarla. El contenido vivo de la escena sigue en
 * `scene_contents`; las revisiones son historial.
 *
 * La numeracion es correlativa por escena y no se renumera al borrar, de modo
 * que el numero identifica siempre a la misma revision.
 */
export interface SceneRevision {
  id: string;
  node_id: string;
  revision_number: number;
  label: string | null;
  content: string;
  plain_text: string | null;
  word_count: number;
  created_at: string | null;
}

/** Revision sin contenido: es lo que se usa para pintar el historial. */
export interface SceneRevisionMeta {
  id: string;
  node_id: string;
  revision_number: number;
  label: string | null;
  word_count: number;
  created_at: string | null;
  /** True cuando la revision contiene exactamente el texto actual de la escena. */
  is_current: boolean;
}

interface RevisionState {
  /** Revisiones de la escena abierta, de la mas reciente a la mas antigua. */
  revisions: SceneRevisionMeta[];
  /** Escena a la que pertenece `revisions`. */
  nodeId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchRevisions: (nodeId: string) => Promise<void>;
  createRevision: (nodeId: string, label?: string) => Promise<SceneRevision>;
  getRevision: (id: string) => Promise<SceneRevision>;
  /** Devuelve el contenido de una revision al texto vivo de la escena. */
  restoreRevision: (id: string) => Promise<string>;
  deleteRevision: (id: string) => Promise<void>;
  clear: () => void;
}

export const useRevisionStore = create<RevisionState>((set, get) => ({
  revisions: [],
  nodeId: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchRevisions: async (nodeId: string) => {
    // Si se ha cambiado de escena, el historial anterior ya no aplica.
    if (get().nodeId !== nodeId) {
      set({ revisions: [], nodeId, error: null });
    }
    set({ isLoading: true, error: null });
    try {
      const revisions = await invoke<SceneRevisionMeta[]>('list_scene_revisions', { nodeId });
      set({ revisions, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Error al obtener las revisiones', isLoading: false });
    }
  },

  createRevision: async (nodeId: string, label?: string) => {
    set({ isSaving: true, error: null });
    try {
      const revision = await invoke<SceneRevision>('create_scene_revision', {
        nodeId,
        label: label?.trim() ? label.trim() : null,
      });
      // Se recarga el historial para mantener el orden correlativo y el contador.
      await get().fetchRevisions(nodeId);
      set({ isSaving: false });
      return revision;
    } catch (e: any) {
      const errMsg = e.message || 'Error al guardar la revision';
      set({ error: errMsg, isSaving: false });
      throw new Error(errMsg);
    }
  },

  getRevision: async (id: string) => {
    return invoke<SceneRevision>('get_scene_revision', { id });
  },

  restoreRevision: async (id: string) => {
    set({ error: null });
    try {
      // Devuelve el id de la escena cuyo texto ha cambiado.
      const nodeId = await invoke<string>('restore_scene_revision', { id });
      if (get().nodeId === nodeId) {
        await get().fetchRevisions(nodeId);
      }
      return nodeId;
    } catch (e: any) {
      const errMsg = e.message || 'Error al restaurar la revision';
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  deleteRevision: async (id: string) => {
    set({ error: null });
    try {
      await invoke('delete_scene_revision', { id });
      const nodeId = get().nodeId;
      if (nodeId) {
        await get().fetchRevisions(nodeId);
      }
    } catch (e: any) {
      const errMsg = e.message || 'Error al eliminar la revision';
      set({ error: errMsg });
      throw new Error(errMsg);
    }
  },

  clear: () => set({ revisions: [], nodeId: null, error: null }),
}));
