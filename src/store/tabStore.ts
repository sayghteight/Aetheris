import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { scheduleWorkspaceSave } from './workspaceStore';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TabType =
  | 'manuscript'
  | 'universe'
  | 'settings'
  | 'timeline'
  | 'calendars'
  | 'import'
  | 'export'
  | 'versioning'
  | 'about'
  | 'character'
  | 'location'
  | 'scene'
  | 'chapter'
  | 'faction'
  | 'item'
  | 'event'
  | 'concept'
  | 'other'
  | 'search';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  icon?: string;
  resourceId?: string; // ID of the resource this tab represents (entry ID, scene ID, etc.)
  isModified?: boolean;
  state?: unknown; // Serialized state for persistence
}

export interface RecentlyClosedTab {
  tab: Tab;
  closedAt: number;
}

// ─── Store Interface ───────────────────────────────────────────────────────────

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  recentlyClosedTabs: RecentlyClosedTab[];
  isLoaded: boolean;

  // Actions
  openTab: (tab: Omit<Tab, 'id'>) => string; // Returns tab ID
  closeTab: (tabId: string) => void;
  closeActiveTab: () => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<Omit<Tab, 'id'>>) => void;
  setTabModified: (tabId: string, isModified: boolean) => void;
  reopenLastClosedTab: () => void;
  getTabByResource: (type: TabType, resourceId: string) => Tab | undefined;

  // Persistence
  loadTabs: () => Promise<void>;
  saveTabs: () => Promise<void>;
}

// ─── Persistence Types ────────────────────────────────────────────────────────

interface RustTabData {
  id: string;
  tab_type: string;
  title: string;
  icon?: string;
  resource_id?: string;
  is_modified: boolean;
  state?: string;
}

interface RustTabState {
  tabs?: RustTabData[];
  active_tab_id?: string | null;
  recently_closed_tabs?: Array<{
    tab: RustTabData;
    closed_at: number;
  }>;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

const MAX_RECENTLY_CLOSED = 10;
const RECENTLY_CLOSED_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  recentlyClosedTabs: [],
  isLoaded: false,

  openTab: (tabData) => {
    const { tabs, openTab: _openTab } = get();

    // Check if a tab with the same resource already exists
    if (tabData.resourceId) {
      const existing = tabs.find(
        (t) => t.type === tabData.type && t.resourceId === tabData.resourceId
      );
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }

    // Also check by type for singleton tabs (like settings, about, etc.)
    const singletonTypes: TabType[] = ['manuscript', 'universe', 'settings', 'about', 'versioning', 'timeline', 'calendars', 'import', 'export'];

    if (singletonTypes.includes(tabData.type)) {
      const existing = tabs.find((t) => t.type === tabData.type);
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }

    // Create new tab
    const id = crypto.randomUUID();
    const newTab: Tab = { id, ...tabData };

    set({
      tabs: [...tabs, newTab],
      activeTabId: id,
    });

    scheduleWorkspaceSave();
    return id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, recentlyClosedTabs } = get();
    const tabIndex = tabs.findIndex((t) => t.id === tabId);

    if (tabIndex === -1) return;

    const closedTab = tabs[tabIndex];
    const newTabs = tabs.filter((t) => t.id !== tabId);

    // Determine new active tab
    let newActiveTabId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // Activate the tab to the right, or the one to the left if this was the last
        const newIndex = Math.min(tabIndex, newTabs.length - 1);
        newActiveTabId = newTabs[newIndex].id;
      } else {
        newActiveTabId = null;
      }
    }

    // Add to recently closed (prune old ones first)
    const now = Date.now();
    const prunedRecent = recentlyClosedTabs
      .filter((r) => now - r.closedAt < RECENTLY_CLOSED_MAX_AGE_MS)
      .slice(0, MAX_RECENTLY_CLOSED - 1);

    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      recentlyClosedTabs: [
        { tab: closedTab, closedAt: now },
        ...prunedRecent,
      ],
    });

    scheduleWorkspaceSave();
  },

  closeActiveTab: () => {
    const { activeTabId, closeTab: _closeTab } = get();
    if (activeTabId) {
      _closeTab(activeTabId);
    }
  },

  setActiveTab: (tabId) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === tabId)) {
      set({ activeTabId: tabId });
      scheduleWorkspaceSave();
    }
  },

  updateTab: (tabId, updates) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId ? { ...t, ...updates } : t
      ),
    });
    scheduleWorkspaceSave();
  },

  setTabModified: (tabId, isModified) => {
    const { tabs } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === tabId ? { ...t, isModified } : t
      ),
    });
    scheduleWorkspaceSave();
  },

  reopenLastClosedTab: () => {
    const { recentlyClosedTabs, tabs } = get();

    // Find the most recently closed tab that isn't already open
    for (const recent of recentlyClosedTabs) {
      const alreadyOpen = tabs.some((t) =>
        t.type === recent.tab.type &&
        t.resourceId === recent.tab.resourceId
      );

      if (!alreadyOpen) {
        // Remove from recently closed
        set({
          recentlyClosedTabs: recentlyClosedTabs.filter(
            (r) => r.closedAt !== recent.closedAt
          ),
        });

        // Reopen the tab
        get().openTab(recent.tab);
        return;
      }
    }
  },

  getTabByResource: (type, resourceId) => {
    const { tabs } = get();
    return tabs.find((t) => t.type === type && t.resourceId === resourceId);
  },

  loadTabs: async () => {
    try {
      const result = await invoke('get_tab_state');

      // Defensive: ensure we have a valid object
      if (!result || typeof result !== 'object') {
        set({ tabs: [], activeTabId: null, recentlyClosedTabs: [], isLoaded: true });
        return;
      }

      const rustState = result as RustTabState;

      // Guard against malformed data - ensure tabs is always an array
      if (!Array.isArray(rustState.tabs)) {
        set({ tabs: [], activeTabId: null, recentlyClosedTabs: [] });
        return;
      }

      const tabs: Tab[] = rustState.tabs.map((t) => ({
        id: t.id,
        type: t.tab_type as TabType,
        title: t.title,
        icon: t.icon,
        resourceId: t.resource_id,
        isModified: t.is_modified,
        state: t.state ? JSON.parse(t.state) : undefined,
      }));

      const recentlyClosedTabs: RecentlyClosedTab[] = (rustState.recently_closed_tabs || [])
        .map((r) => ({
          tab: {
            id: r.tab.id,
            type: r.tab.tab_type as TabType,
            title: r.tab.title,
            icon: r.tab.icon,
            resourceId: r.tab.resource_id,
            isModified: r.tab.is_modified,
            state: r.tab.state ? JSON.parse(r.tab.state) : undefined,
          },
          closedAt: r.closed_at,
        }))
        .filter((r) => Date.now() - r.closedAt < RECENTLY_CLOSED_MAX_AGE_MS);

      set({
        tabs,
        activeTabId: rustState.active_tab_id,
        recentlyClosedTabs,
        isLoaded: true,
      });
    } catch (e) {
      console.error('[loadTabs] Error loading tab state:', e);
      // Initialize with empty state on error
      set({ tabs: [], activeTabId: null, recentlyClosedTabs: [], isLoaded: true });
    }
  },

  saveTabs: async () => {
    try {
      const { tabs, activeTabId, recentlyClosedTabs } = get();

      const rustTabs: RustTabData[] = tabs.map((t) => ({
        id: t.id,
        tab_type: t.type,
        title: t.title,
        icon: t.icon,
        resource_id: t.resourceId,
        is_modified: t.isModified ?? false,
        state: t.state ? JSON.stringify(t.state) : undefined,
      }));

      const rustRecentlyClosed = recentlyClosedTabs.map((r) => ({
        tab: {
          id: r.tab.id,
          tab_type: r.tab.type,
          title: r.tab.title,
          icon: r.tab.icon,
          resource_id: r.tab.resourceId,
          is_modified: r.tab.isModified ?? false,
          state: r.tab.state ? JSON.stringify(r.tab.state) : undefined,
        },
        closed_at: r.closedAt,
      }));

      await invoke('save_tab_state', {
        data: {
          tabs: rustTabs,
          active_tab_id: activeTabId,
          recently_closed_tabs: rustRecentlyClosed,
        },
      });
    } catch (e) {
      console.error('Error saving tab state:', e);
    }
  },
}));

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Open a universe entry in a new tab or focus existing tab
 */
export const openUniverseEntryTab = (
  entryId: string,
  entryName: string,
  entryType: string = 'other'
) => {
  const { openTab } = useTabStore.getState();

  // Map entry types to tab types
  const tabTypeMap: Record<string, TabType> = {
    character: 'character',
    location: 'location',
    faction: 'faction',
    item: 'item',
    event: 'event',
    concept: 'concept',
    creature: 'concept',
    kingdom: 'location',
    other: 'concept',
  };

  const tabType = tabTypeMap[entryType] || 'concept';

  openTab({
    type: tabType,
    title: entryName,
    resourceId: entryId,
  });
};

/**
 * Open a manuscript node (chapter/scene) in a new tab or focus existing tab
 */
export const openManuscriptNodeTab = (
  nodeId: string,
  nodeTitle: string,
  nodeType: 'chapter' | 'scene' | 'part' | 'folder'
) => {
  const { openTab } = useTabStore.getState();

  const tabType: TabType = nodeType === 'scene' ? 'scene' : 'chapter';

  openTab({
    type: tabType,
    title: nodeTitle,
    resourceId: nodeId,
  });
};

/**
 * Open a main view (manuscript, universe, settings, etc.) in a tab
 */
export const openMainViewTab = (viewType: Exclude<TabType, 'character' | 'location' | 'scene' | 'chapter' | 'faction' | 'item' | 'event' | 'concept'>) => {
  const { openTab } = useTabStore.getState();

  const viewTitles: Record<string, string> = {
    manuscript: 'Manuscript',
    universe: 'Universe',
    settings: 'Settings',
    timeline: 'Timeline',
    calendars: 'Calendars',
    import: 'Import',
    export: 'Export',
    versioning: 'Versioning',
    about: 'About',
    search: 'Search',
  };

  openTab({
    type: viewType,
    title: viewTitles[viewType] || viewType,
  });
};
