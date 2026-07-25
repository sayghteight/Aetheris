import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type ThemeOption = 'midnight' | 'aurora' | 'noir';

export interface AppSettingsState {
  theme: ThemeOption;
  focus_mode: string;
  auto_save_enabled: boolean;
  auto_save_interval_minutes: number;
  language: string;
  writing_style: string;
  spell_check_languages: string[];
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textAlign?: string;
  spellCheck?: boolean;
  autoCorrect?: boolean;
  showWordCount?: boolean;
}

interface SettingsStore {
  settings: AppSettingsState;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (nextSettings: AppSettingsState) => Promise<void>;
}

const defaultSettings: AppSettingsState = {
  theme: 'midnight',
  focus_mode: 'standard',
  auto_save_enabled: true,
  auto_save_interval_minutes: 5,
  language: 'es',
  writing_style: 'creative',
  spell_check_languages: ['es', 'en'],
  fontSize: 16,
  lineHeight: 1.6,
  fontFamily: 'default',
  textAlign: 'left',
  spellCheck: true,
  autoCorrect: false,
  showWordCount: true,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const loaded = await invoke<AppSettingsState>('get_project_settings');
      set({
        settings: {
          ...defaultSettings,
          ...loaded,
        },
        isLoaded: true,
      });
    } catch (error) {
      console.error('No se pudieron cargar las preferencias:', error);
      set({ isLoaded: true });
    }
  },

  saveSettings: async (nextSettings) => {
    set({ settings: nextSettings });
    try {
      await invoke('update_project_settings', { settings: nextSettings });
    } catch (error) {
      console.error('No se pudieron guardar las preferencias:', error);
    }
  },
}));
