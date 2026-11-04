import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

/**
 * Ajustes que pertenecen a la novela y no a la aplicacion.
 *
 * El resto de preferencias (tema, idioma, tipografia, autoguardado, ventana)
 * viven en `appSettingsStore`, que las guarda en el archivo de ajustes de la
 * aplicacion. Aqui solo queda lo que tiene sentido por obra.
 *
 * Ojo: cada campo de este tipo tiene que existir en la tabla `project_settings`
 * de Rust. Un campo que no exista alli se pierde en silencio al guardar, que es
 * exactamente lo que pasaba con los ajustes de tipografia.
 */
export interface AppSettingsState {
  /** Modo de la interfaz: standard | focus | distraction-free. */
  focus_mode: string;
  /** Idiomas del corrector. */
  spell_check_languages: string[];
}

interface SettingsStore {
  settings: AppSettingsState;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (nextSettings: AppSettingsState) => Promise<void>;
}

const defaultSettings: AppSettingsState = {
  focus_mode: 'standard',
  spell_check_languages: ['es', 'en'],
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const loaded = await invoke<Partial<AppSettingsState>>('get_project_settings');
      // Cualquier campo ausente se completa con su valor por defecto.
      const mapped: AppSettingsState = {
        focus_mode: loaded.focus_mode ?? defaultSettings.focus_mode,
        spell_check_languages:
          loaded.spell_check_languages ?? defaultSettings.spell_check_languages,
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
      await invoke('update_project_settings', { settings: nextSettings });
    } catch (error) {
      console.error('No se pudieron guardar las preferencias:', error);
    }
  },
}));
