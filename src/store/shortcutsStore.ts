import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type ModifierKey = 'ctrl' | 'alt' | 'shift' | 'meta';
export type ShortcutAction =
  | 'save'
  | 'bold'
  | 'italic'
  | 'underline';

export interface Shortcut {
  key: string;
  modifiers: ModifierKey[];
}

export interface ShortcutDefinition {
  action: ShortcutAction;
  label: string;
  description: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { action: 'save', label: 'Guardar', description: 'Guardar escena actual' },
  { action: 'bold', label: 'Negrita', description: 'Aplicar formato negrita' },
  { action: 'italic', label: 'Cursiva', description: 'Aplicar formato cursiva' },
  { action: 'underline', label: 'Subrayado', description: 'Aplicar formato subrayado' },
];

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, Shortcut> = {
  save: { key: 's', modifiers: ['ctrl'] },
  bold: { key: 'b', modifiers: ['ctrl'] },
  italic: { key: 'i', modifiers: ['ctrl'] },
  underline: { key: 'u', modifiers: ['ctrl'] },
};

interface ShortcutsState {
  shortcuts: Record<ShortcutAction, Shortcut>;
  isLoaded: boolean;
  loadShortcuts: () => Promise<void>;
  saveShortcuts: () => Promise<void>;
  setShortcut: (action: ShortcutAction, shortcut: Shortcut) => { conflict: ShortcutAction | null };
  resetToDefaults: () => void;
  getShortcut: (action: ShortcutAction) => Shortcut;
  formatShortcut: (shortcut: Shortcut) => string;
  normalizeEvent: (e: KeyboardEvent) => { key: string; modifiers: ModifierKey[] } | null;
}

const SHORTCUTS_KEY = 'keyboard_shortcuts';

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: { ...DEFAULT_SHORTCUTS },
  isLoaded: false,

  loadShortcuts: async () => {
    try {
      const data = await invoke<string | null>('get_app_settings', { key: SHORTCUTS_KEY });
      if (data) {
        const parsed = JSON.parse(data);
        // Merge with defaults (any missing actions use default)
        const shortcuts = { ...DEFAULT_SHORTCUTS, ...parsed };
        set({ shortcuts, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (e) {
      console.error('Error loading shortcuts:', e);
      set({ isLoaded: true });
    }
  },

  saveShortcuts: async () => {
    try {
      const { shortcuts } = get();
      await invoke('save_app_settings', {
        key: SHORTCUTS_KEY,
        value: JSON.stringify(shortcuts),
      });
    } catch (e) {
      console.error('Error saving shortcuts:', e);
    }
  },

  setShortcut: (action, shortcut) => {
    const { shortcuts } = get();
    // Check for conflicts
    let conflict: ShortcutAction | null = null;
    for (const [existingAction, existingShortcut] of Object.entries(shortcuts)) {
      if (existingAction === action) continue;
      if (
        existingShortcut.key.toLowerCase() === shortcut.key.toLowerCase() &&
        existingShortcut.modifiers.length === shortcut.modifiers.length &&
        existingShortcut.modifiers.every((m) => shortcut.modifiers.includes(m))
      ) {
        conflict = existingAction as ShortcutAction;
        break;
      }
    }

    const newShortcuts = { ...shortcuts, [action]: shortcut };
    set({ shortcuts: newShortcuts });
    get().saveShortcuts();
    return { conflict };
  },

  resetToDefaults: () => {
    set({ shortcuts: { ...DEFAULT_SHORTCUTS } });
    get().saveShortcuts();
  },

  getShortcut: (action) => {
    return get().shortcuts[action];
  },

  formatShortcut: (shortcut) => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const parts: string[] = [];

    for (const mod of shortcut.modifiers) {
      if (mod === 'ctrl') parts.push(isMac ? '⌃' : 'Ctrl');
      else if (mod === 'alt') parts.push(isMac ? '⌥' : 'Alt');
      else if (mod === 'shift') parts.push(isMac ? '⇧' : 'Shift');
      else if (mod === 'meta') parts.push(isMac ? '⌘' : 'Meta');
    }

    const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
    parts.push(key);

    return parts.join(isMac ? '' : '+');
  },

  normalizeEvent: (e) => {
    const modifiers: ModifierKey[] = [];
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.altKey) modifiers.push('alt');
    if (e.shiftKey) modifiers.push('shift');
    if (e.metaKey) modifiers.push('meta');

    return { key: e.key.toLowerCase(), modifiers };
  },
}));
