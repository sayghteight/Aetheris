import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type ThemeOption = 'midnight' | 'aurora' | 'noir' | 'light';

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
  centeredWritingMode?: boolean;
  centeredWritingPosition?: number; // 30, 40, 50, 60
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
  centeredWritingMode: false,
  centeredWritingPosition: 50,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const loaded = await invoke<AppSettingsState>('get_project_settings');
      // Convert snake_case from Rust to camelCase
      const mapped: AppSettingsState = {
        ...defaultSettings,
        theme: loaded.theme,
        focus_mode: loaded.focus_mode,
        auto_save_enabled: loaded.auto_save_enabled,
        auto_save_interval_minutes: loaded.auto_save_interval_minutes,
        language: loaded.language,
        writing_style: loaded.writing_style,
        spell_check_languages: loaded.spell_check_languages,
        fontSize: loaded.fontSize,
        lineHeight: loaded.lineHeight,
        fontFamily: loaded.fontFamily,
        textAlign: loaded.textAlign,
        spellCheck: loaded.spellCheck,
        autoCorrect: loaded.autoCorrect,
        showWordCount: loaded.showWordCount,
        centeredWritingMode: (loaded as any).centered_writing_mode,
        centeredWritingPosition: (loaded as any).centered_writing_position,
      };
      set({
        settings: mapped,
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
      // Convert camelCase to snake_case for Rust
      const rustSettings = {
        theme: nextSettings.theme,
        focus_mode: nextSettings.focus_mode,
        auto_save_enabled: nextSettings.auto_save_enabled,
        auto_save_interval_minutes: nextSettings.auto_save_interval_minutes,
        language: nextSettings.language,
        writing_style: nextSettings.writing_style,
        spell_check_languages: nextSettings.spell_check_languages,
        fontSize: nextSettings.fontSize,
        lineHeight: nextSettings.lineHeight,
        fontFamily: nextSettings.fontFamily,
        textAlign: nextSettings.textAlign,
        spellCheck: nextSettings.spellCheck,
        autoCorrect: nextSettings.autoCorrect,
        showWordCount: nextSettings.showWordCount,
        centered_writing_mode: nextSettings.centeredWritingMode ?? false,
        centered_writing_position: nextSettings.centeredWritingPosition ?? 50,
      };
      await invoke('update_project_settings', { settings: rustSettings });
    } catch (error) {
      console.error('No se pudieron guardar las preferencias:', error);
    }
  },
}));
