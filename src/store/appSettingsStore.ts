import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type AppTheme = 'midnight' | 'aurora' | 'noir' | 'light';
/** Tipografia disponible para el editor. */
export type EditorFontFamily = 'serif' | 'sans' | 'mono';
/** Alineacion del parrafo en el editor. */
export type EditorTextAlign = 'left' | 'justify' | 'center';

export interface AppSettings {
  /** Tema de la interfaz. */
  theme: AppTheme;
  /** Idioma de la interfaz. */
  language: string;
  /** Ancho de la ventana en pixeles logicos. */
  windowWidth: number;
  /** Alto de la ventana en pixeles logicos. */
  windowHeight: number;
  /** Si la ventana se abre maximizada. */
  windowMaximized: boolean;
  /** Si la ventana esta en pantalla completa. */
  windowFullscreen: boolean;
  /** Si se restaura el tamano de ventana guardado al arrancar. */
  restoreWindowOnStart: boolean;
  /** Si se abre el ultimo proyecto al arrancar. */
  openLastProjectOnStart: boolean;
  /** Si se pide confirmacion antes de cerrar la aplicacion. */
  confirmBeforeClose: boolean;
  /** Zoom de la interfaz (1 = 100 %). */
  interfaceZoom: number;
  /** Si la ventana se mantiene siempre encima. */
  alwaysOnTop: boolean;
  /** Si la ventana se puede redimensionar. */
  resizable: boolean;
  /** Tipografia del editor. */
  fontFamily: EditorFontFamily;
  /** Tamano de letra del editor, en pixeles. */
  fontSize: number;
  /** Interlineado del editor. */
  lineHeight: number;
  /** Alineacion del parrafo en el editor. */
  textAlign: EditorTextAlign;
  /** Si se muestra el contador de palabras. */
  showWordCount: boolean;
  /** Modo de escritura centrada: el cursor queda fijo en una banda central. */
  centeredWritingMode: boolean;
  /** Altura de la banda central, en porcentaje del alto del editor. */
  centeredWritingPosition: number;
  /** Si el editor guarda solo los cambios. */
  autoSaveEnabled: boolean;
  /** Retardo del autoguardado, en milisegundos. */
  autoSaveDelayMs: number;
  /** Si el corrector ortografico esta activo. */
  spellCheckEnabled: boolean;
  /** Idiomas con los que se comprueba la ortografia. */
  spellCheckLanguages: string[];
  /** Si los nombres de la novela se consideran palabras correctas. */
  spellCheckUseUniverseNames: boolean;
}

/** Clave dentro del almacen generico de la aplicacion (`{config}/app_settings.json`). */
const SETTINGS_KEY = 'app_settings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'midnight',
  language: 'es',
  windowWidth: 1280,
  windowHeight: 800,
  windowMaximized: false,
  windowFullscreen: false,
  restoreWindowOnStart: true,
  openLastProjectOnStart: false,
  confirmBeforeClose: false,
  interfaceZoom: 1,
  alwaysOnTop: false,
  resizable: true,
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.75,
  textAlign: 'left',
  showWordCount: true,
  centeredWritingMode: false,
  centeredWritingPosition: 50,
  autoSaveEnabled: true,
  autoSaveDelayMs: 700,
  spellCheckEnabled: true,
  spellCheckLanguages: ['es'],
  spellCheckUseUniverseNames: true,
};

interface AppSettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const raw = await invoke<string | null>('get_app_settings', { key: SETTINGS_KEY });
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        // Cualquier ajuste ausente se completa con su valor por defecto.
        set({ settings: { ...DEFAULT_APP_SETTINGS, ...parsed }, isLoaded: true });
        return;
      }
    } catch (error) {
      console.error(error);
    }
    set({ isLoaded: true });
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    // Se actualiza el estado al instante y se persiste en segundo plano.
    set({ settings: next });
    try {
      await invoke('save_app_settings', {
        key: SETTINGS_KEY,
        value: JSON.stringify(next),
      });
    } catch (error) {
      console.error(error);
    }
  },
}));
