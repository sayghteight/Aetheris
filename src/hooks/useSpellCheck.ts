import { useSettingsStore } from '../store/settingsStore';

export interface MisspelledWord {
  word: string;
  suggestions: string[];
  index: number;
}

export interface UseSpellCheckReturn {
  isLoading: boolean;
  misspelledWords: MisspelledWord[];
  checkText: (text: string) => Promise<void>;
  checkTextSync: (text: string) => string[];
  getSuggestions: (word: string) => string[];
  isReady: boolean;
  loadedLanguages: string[];
}

export function useSpellCheck(): UseSpellCheckReturn {
  const { settings } = useSettingsStore();
  const languages = settings.spell_check_languages || ['es', 'en'];

  // Native browser spell check handles everything - we just provide the interface
  return {
    isLoading: false,
    misspelledWords: [],
    checkText: async () => {},
    checkTextSync: () => [],
    getSuggestions: () => [],
    isReady: true,
    loadedLanguages: languages,
  };
}
