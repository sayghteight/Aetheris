import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  UniverseCategory,
  UniverseEntryType,
  UniverseEntry,
  UniverseBlock,
  UniverseRelation,
  UniverseData,
  UniverseEntryWithBlocks,
  EntryWizardData,
  UniverseViewState,
  BlockType,
  LayoutType,
  BlockContent,
} from '../types';

// ─── Store State ──────────────────────────────────────────────────────────────

interface UniverseState {
  // Data
  categories: UniverseCategory[];
  entryTypes: UniverseEntryType[];
  entries: UniverseEntry[];
  blocks: Map<string, UniverseBlock[]>;
  relations: UniverseRelation[];

  // UI State
  viewState: UniverseViewState;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions - Data fetching
  loadUniverse: () => Promise<void>;

  // Actions - Entry CRUD
  createEntry: (data: EntryWizardData, layout?: LayoutType) => Promise<UniverseEntry>;
  updateEntry: (entry: UniverseEntry, blocks: UniverseBlock[]) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Actions - Block CRUD
  addBlock: (entryId: string, columnIndex: 0 | 1 | 2, blockType: BlockType) => Promise<UniverseBlock>;
  updateBlock: (blockId: string, updates: Partial<UniverseBlock>) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  moveBlock: (blockId: string, targetColumn: 0 | 1 | 2, targetOrder: number) => Promise<void>;
  reorderBlocks: (entryId: string, columnIndex: 0 | 1 | 2, blockIds: string[]) => Promise<void>;

  // Actions - Category CRUD
  createCategory: (name: string, description?: string, icon?: string, color?: string) => Promise<UniverseCategory>;
  updateCategory: (id: string, name: string, description?: string, icon?: string, color?: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Actions - Relations
  addRelation: (sourceId: string, targetId: string, type: string, description?: string) => Promise<void>;
  removeRelation: (id: string) => Promise<void>;

  // Actions - Navigation
  setView: (view: 'index' | 'category' | 'entry') => void;
  selectCategory: (categoryId: string | null) => void;
  selectEntry: (entryId: string | null) => void;
  setEditMode: (editMode: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (type: UniverseEntryType['id'] | 'all') => void;

  // Actions - Helpers
  getEntryBlocks: (entryId: string) => UniverseBlock[];
  getEntryRelations: (entryId: string) => UniverseRelation[];
  searchEntries: (query: string) => UniverseEntry[];
  getRecentEntries: (limit?: number) => UniverseEntry[];
  getEntriesByType: (type: UniverseEntryType['id']) => UniverseEntry[];
  getEntriesByCategory: (categoryId: string) => UniverseEntry[];
}

// ─── Implementation ────────────────────────────────────────────────────────────

export const useUniverseStore = create<UniverseState>((set, get) => ({
  // Initial state
  categories: [],
  entryTypes: [],
  entries: [],
  blocks: new Map(),
  relations: [],

  viewState: {
    mode: 'index',
    selectedCategoryId: null,
    selectedEntryId: null,
    editMode: false,
    searchQuery: '',
    filterType: 'all',
  },

  isLoading: false,
  isSaving: false,
  error: null,

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  loadUniverse: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await invoke<UniverseData>('get_universe');

      // Build blocks map (entryId -> blocks[])
      const blocksMap = new Map<string, UniverseBlock[]>();
      for (const block of data.blocks) {
        const existing = blocksMap.get(block.entryId) || [];
        existing.push(block);
        blocksMap.set(block.entryId, existing);
      }

      // Sort blocks by order within each entry
      for (const [entryId, entryBlocks] of blocksMap) {
        entryBlocks.sort((a, b) => a.blockOrder - b.blockOrder);
        blocksMap.set(entryId, entryBlocks);
      }

      // Data already comes in camelCase from Rust due to #[serde(rename_all = "camelCase")]
      const categories: UniverseCategory[] = data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        color: c.color,
        sortOrder: c.sortOrder,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      const entryTypes: UniverseEntryType[] = data.entryTypes.map((t) => ({
        id: t.id as UniverseEntryType['id'],
        nameEs: t.nameEs,
        nameEn: t.nameEn,
        icon: t.icon,
        color: t.color,
      }));

      const entries: UniverseEntry[] = data.entries.map((e) => ({
        id: e.id,
        categoryId: e.categoryId,
        entryType: e.entryType as UniverseEntry['entryType'],
        name: e.name,
        briefDescription: e.briefDescription,
        icon: e.icon,
        coverImageId: e.coverImageId,
        layout: (e.layout || '1-col') as LayoutType,
        isFeatured: e.isFeatured || false,
        tags: e.tags || [],
        metadata: e.metadata || {},
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));

      const relations: UniverseRelation[] = data.relations.map((r) => ({
        id: r.id,
        sourceEntryId: r.sourceEntryId,
        targetEntryId: r.targetEntryId,
        relationType: r.relationType,
        description: r.description,
        createdAt: r.createdAt,
      }));

      set({
        categories,
        entryTypes,
        entries,
        blocks: blocksMap,
        relations,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading universe:', error);
      set({ error: String(error), isLoading: false });
    }
  },

  // ─── Entry CRUD ────────────────────────────────────────────────────────────

  createEntry: async (data: EntryWizardData, layout: LayoutType = '1-col') => {
    const { entries, blocks } = get();

    const entry: UniverseEntry = {
      id: crypto.randomUUID(),
      categoryId: data.categoryId,
      entryType: data.type,
      name: data.name,
      briefDescription: data.description,
      icon: data.icon,
      coverImageId: data.coverImageId,
      layout,
      isFeatured: false,
      tags: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create default rich-text block
    const defaultBlock: UniverseBlock = {
      id: crypto.randomUUID(),
      entryId: entry.id,
      columnIndex: 0,
      blockOrder: 0,
      blockType: 'rich-text',
      content: { type: 'rich-text', html: '' },
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };

    try {
      const now = new Date().toISOString();
      await invoke<UniverseEntryWithBlocks>('create_universe_entry', {
        entry: {
          id: entry.id,
          categoryId: entry.categoryId,
          entryType: entry.entryType,
          name: entry.name,
          briefDescription: entry.briefDescription,
          icon: entry.icon,
          coverImageId: entry.coverImageId,
          layout: entry.layout,
          isFeatured: entry.isFeatured,
          tags: entry.tags,
          metadata: entry.metadata,
          createdAt: now,
          updatedAt: now,
        },
        blocks: [
          {
            id: defaultBlock.id,
            entryId: defaultBlock.entryId,
            columnIndex: defaultBlock.columnIndex,
            blockOrder: defaultBlock.blockOrder,
            blockType: defaultBlock.blockType,
            content: defaultBlock.content,
            createdAt: now,
            updatedAt: now,
          },
        ],
      });

      // Update local state
      set({ entries: [...entries, entry] });

      // Update blocks map
      const newBlocks = new Map(blocks);
      newBlocks.set(entry.id, [defaultBlock]);
      set({ blocks: newBlocks });

      return entry;
    } catch (error) {
      console.error('Error creating entry:', error);
      throw error;
    }
  },

  updateEntry: async (entry: UniverseEntry, entryBlocks: UniverseBlock[]) => {
    set({ isSaving: true });
    try {
      const now = new Date().toISOString();
      const entryCreatedAt = entry.createdAt ?? now;
      await invoke<UniverseEntryWithBlocks>('update_universe_entry', {
        entry: {
          id: entry.id,
          categoryId: entry.categoryId,
          entryType: entry.entryType,
          name: entry.name,
          briefDescription: entry.briefDescription,
          icon: entry.icon,
          coverImageId: entry.coverImageId,
          layout: entry.layout,
          isFeatured: entry.isFeatured,
          tags: entry.tags,
          metadata: entry.metadata,
          createdAt: entryCreatedAt,
          updatedAt: now,
        },
        blocks: entryBlocks.map((b) => ({
          id: b.id,
          entryId: b.entryId,
          columnIndex: b.columnIndex,
          blockOrder: b.blockOrder,
          blockType: b.blockType,
          content: b.content,
          createdAt: b.createdAt ?? now,
          updatedAt: now,
        })),
      });

      // Update local state
      const { entries, blocks } = get();
      const updatedEntries = entries.map((e) => (e.id === entry.id ? entry : e));
      const updatedBlocks = new Map(blocks);
      updatedBlocks.set(entry.id, entryBlocks);
      set({ entries: updatedEntries, blocks: updatedBlocks, isSaving: false });
    } catch (error) {
      console.error('Error updating entry:', error);
      set({ isSaving: false, error: String(error) });
      throw error;
    }
  },

  deleteEntry: async (id: string) => {
    try {
      await invoke('delete_universe_entry', { id });

      // Update local state
      const { entries, blocks } = get();
      const newBlocks = new Map(blocks);
      newBlocks.delete(id);
      set({
        entries: entries.filter((e) => e.id !== id),
        blocks: newBlocks,
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
  },

  // ─── Block CRUD ────────────────────────────────────────────────────────────

  addBlock: async (entryId: string, columnIndex: 0 | 1 | 2, blockType: BlockType) => {
    const { blocks } = get();
    const entryBlocks = blocks.get(entryId) || [];
    const order = entryBlocks.filter((b) => b.columnIndex === columnIndex).length;

    const newBlock: UniverseBlock = {
      id: crypto.randomUUID(),
      entryId,
      columnIndex,
      blockOrder: order,
      blockType,
      content: getDefaultContent(blockType),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update local state immediately (optimistic)
    const newBlocks = new Map(blocks);
    const updatedEntryBlocks = [...entryBlocks, newBlock];
    newBlocks.set(entryId, updatedEntryBlocks);
    console.log('[addBlock] entryId:', entryId, 'columnIndex:', columnIndex, 'new blockOrder:', order, 'total blocks:', updatedEntryBlocks.length);
    set({ blocks: newBlocks });

    return newBlock;
  },

  updateBlock: async (blockId: string, updates: Partial<UniverseBlock>) => {
    const { blocks } = get();
    const newBlocks = new Map(blocks);

    for (const [entryId, entryBlocks] of newBlocks) {
      const idx = entryBlocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        const updated = { ...entryBlocks[idx], ...updates, updatedAt: new Date().toISOString() };
        entryBlocks[idx] = updated;
        newBlocks.set(entryId, [...entryBlocks]);
        set({ blocks: newBlocks });
        return;
      }
    }
  },

  deleteBlock: async (blockId: string) => {
    const { blocks } = get();
    const newBlocks = new Map(blocks);

    for (const [entryId, entryBlocks] of newBlocks) {
      const idx = entryBlocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        const filtered = entryBlocks.filter((b) => b.id !== blockId);
        // Reorder remaining blocks
        filtered.forEach((b, i) => (b.blockOrder = i));
        newBlocks.set(entryId, filtered);
        set({ blocks: newBlocks });
        return;
      }
    }
  },

  moveBlock: async (blockId: string, targetColumn: 0 | 1 | 2, targetOrder: number) => {
    const { blocks } = get();
    const newBlocks = new Map(blocks);

    for (const [entryId, entryBlocks] of newBlocks) {
      const idx = entryBlocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        const block = entryBlocks[idx];
        const oldColumn = block.columnIndex;

        // Remove from old position
        const filtered = entryBlocks.filter((b) => b.id !== blockId);

        // Update block
        block.columnIndex = targetColumn;
        block.blockOrder = targetOrder;
        block.updatedAt = new Date().toISOString();

        // Insert at new position
        filtered.splice(targetOrder, 0, block);

        // Reorder all blocks in target column
        let order = 0;
        for (const b of filtered) {
          if (b.columnIndex === targetColumn) {
            b.blockOrder = order++;
          }
        }

        // Reorder blocks in old column if different
        if (oldColumn !== targetColumn) {
          let oldOrder = 0;
          for (const b of filtered) {
            if (b.columnIndex === oldColumn) {
              b.blockOrder = oldOrder++;
            }
          }
        }

        newBlocks.set(entryId, filtered);
        set({ blocks: newBlocks });
        return;
      }
    }
  },

  reorderBlocks: async (entryId: string, columnIndex: 0 | 1 | 2, blockIds: string[]) => {
    const { blocks } = get();
    const newBlocks = new Map(blocks);
    const entryBlocks = newBlocks.get(entryId) || [];

    // Reorder based on blockIds array
    blockIds.forEach((id, index) => {
      const block = entryBlocks.find((b) => b.id === id);
      if (block) {
        block.blockOrder = index;
        block.columnIndex = columnIndex;
        block.updatedAt = new Date().toISOString();
      }
    });

    newBlocks.set(entryId, [...entryBlocks]);
    set({ blocks: newBlocks });
  },

  // ─── Category CRUD ─────────────────────────────────────────────────────────

  createCategory: async (name: string, description?: string, icon?: string, color?: string) => {
    try {
      const result = await invoke<{
        id: string;
        name: string;
        description?: string;
        icon?: string;
        color?: string;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>('create_universe_category', { name, description, icon, color });

      const category: UniverseCategory = {
        id: result.id,
        name: result.name,
        description: result.description,
        icon: result.icon,
        color: result.color,
        sortOrder: result.sort_order,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };

      set({ categories: [...get().categories, category] });
      return category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  },

  updateCategory: async (id: string, name: string, description?: string, icon?: string, color?: string) => {
    try {
      await invoke('update_universe_category', { id, name, description, icon, color });

      set({
        categories: get().categories.map((c) =>
          c.id === id ? { ...c, name, description, icon, color, updatedAt: new Date().toISOString() } : c
        ),
      });
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await invoke('delete_universe_category', { id });
      set({ categories: get().categories.filter((c) => c.id !== id) });
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // ─── Relations ─────────────────────────────────────────────────────────────

  addRelation: async (sourceId: string, targetId: string, type: string, description?: string) => {
    try {
      const result = await invoke<{
        id: string;
        source_entry_id: string;
        target_entry_id: string;
        relation_type: string;
        description?: string;
        created_at: string;
      }>('create_universe_relation', { sourceEntryId: sourceId, targetEntryId: targetId, relationType: type, description });

      const relation: UniverseRelation = {
        id: result.id,
        sourceEntryId: result.source_entry_id,
        targetEntryId: result.target_entry_id,
        relationType: result.relation_type,
        description: result.description,
        createdAt: result.created_at,
      };

      set({ relations: [...get().relations, relation] });
    } catch (error) {
      console.error('Error adding relation:', error);
      throw error;
    }
  },

  removeRelation: async (id: string) => {
    try {
      await invoke('delete_universe_relation', { id });
      set({ relations: get().relations.filter((r) => r.id !== id) });
    } catch (error) {
      console.error('Error removing relation:', error);
      throw error;
    }
  },

  // ─── Navigation ────────────────────────────────────────────────────────────

  setView: (view) => set({ viewState: { ...get().viewState, mode: view } }),
  selectCategory: (categoryId) => set({ viewState: { ...get().viewState, selectedCategoryId: categoryId } }),
  selectEntry: (entryId) => set({ viewState: { ...get().viewState, selectedEntryId: entryId } }),
  setEditMode: (editMode) => set({ viewState: { ...get().viewState, editMode } }),
  setSearchQuery: (searchQuery) => set({ viewState: { ...get().viewState, searchQuery } }),
  setFilterType: (filterType) => set({ viewState: { ...get().viewState, filterType } }),

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getEntryBlocks: (entryId: string) => get().blocks.get(entryId) || [],

  getEntryRelations: (entryId: string) =>
    get().relations.filter((r) => r.sourceEntryId === entryId || r.targetEntryId === entryId),

  searchEntries: (query: string) => {
    const { entries, viewState } = get();
    const q = query.toLowerCase();

    return entries.filter((e) => {
      const desc = e.briefDescription || '';
      const matchesQuery = !q || e.name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      const matchesType = viewState.filterType === 'all' || e.entryType === viewState.filterType;
      return matchesQuery && matchesType;
    });
  },

  getRecentEntries: (limit = 10) => {
    const { entries } = get();
    return [...entries]
      .filter((e) => e && e.id && e.updatedAt)
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime() || 0;
        const bTime = new Date(b.updatedAt).getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  },

  getEntriesByType: (type) => get().entries.filter((e) => e.entryType === type),

  getEntriesByCategory: (categoryId) => get().entries.filter((e) => e.categoryId === categoryId),
}));

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getDefaultContent(blockType: BlockType): BlockContent {
  switch (blockType) {
    case 'rich-text':
      return { type: 'rich-text', html: '' };
    case 'image':
      return { type: 'image', assetId: '' };
    case 'gallery':
      return { type: 'gallery', assetIds: [], layout: 'grid' };
    case 'list':
      return { type: 'list', style: 'bullet', items: [] };
    case 'quote':
      return { type: 'quote', text: '', attribution: '' };
    case 'key-info':
      return { type: 'key-info', fields: [] };
    case 'table':
      return { type: 'table', headers: [], rows: [] };
    case 'divider':
      return { type: 'divider', style: 'line' };
    case 'related-links':
      return { type: 'related-links', links: [] };
    case 'entry-reference':
      return { type: 'entry-reference', referenceId: '', displayMode: 'card' };
    default:
      return { type: 'rich-text', html: '' };
  }
}
