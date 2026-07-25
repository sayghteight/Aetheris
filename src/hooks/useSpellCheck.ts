import { useState, useEffect, useCallback, useRef } from 'react';
import { spellChecker } from '../utils/spellChecker';
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
  const [isLoading, setIsLoading] = useState(false);
  const [misspelledWords, setMisspelledWords] = useState<MisspelledWord[]>([]);
  const [isReady, setIsReady] = useState(false);
  const loadedLanguagesRef = useRef<string[]>([]);

  const languages = settings.spell_check_languages || ['es', 'en'];

  // Load dictionaries for configured languages
  useEffect(() => {
    let mounted = true;
    const loadDictionaries = async () => {
      setIsLoading(true);
      setIsReady(false);
      try {
        await Promise.all(languages.map(lang => spellChecker.loadDictionary(lang)));
        if (mounted) {
          loadedLanguagesRef.current = languages;
          setIsReady(true);
        }
      } catch (error) {
        console.error('Error loading spell check dictionaries:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadDictionaries();

    return () => {
      mounted = false;
    };
  }, [languages.join(',')]); // Re-load when languages change

  // Find misspelled words with their positions
  const findMisspelled = useCallback((text: string, langs: string[]): MisspelledWord[] => {
    const words = text.match(/[\w''']+/g) || [];
    const results: MisspelledWord[] = [];
    let searchIndex = 0;

    for (const word of words) {
      const cleanWord = word.replace(/[''']/g, "'");

      // Check if word is correct in any language
      let isCorrect = false;
      for (const lang of langs) {
        if (spellChecker.checkWordSync(cleanWord, lang)) {
          isCorrect = true;
          break;
        }
      }

      if (!isCorrect) {
        const index = text.indexOf(word, searchIndex);
        if (index !== -1) {
          results.push({
            word: cleanWord,
            suggestions: [],
            index,
          });
          searchIndex = index + word.length;
        }
      } else {
        searchIndex = text.indexOf(word, searchIndex) + word.length;
      }
    }

    return results;
  }, []);

  // Async check with suggestions
  const checkText = useCallback(async (text: string): Promise<void> => {
    const misspellings = findMisspelled(text, languages);

    // Load suggestions for misspelled words
    const withSuggestions = await Promise.all(
      misspellings.map(async (m) => {
        const suggestions: string[] = [];
        for (const lang of languages) {
          const s = await spellChecker.getSuggestions(m.word, lang);
          suggestions.push(...s);
          if (suggestions.length >= 5) break;
        }
        return {
          ...m,
          suggestions: [...new Set(suggestions)].slice(0, 5),
        };
      })
    );

    setMisspelledWords(withSuggestions);
  }, [languages, findMisspelled]);

  // Sync check (fast, for real-time checking)
  const checkTextSync = useCallback((text: string): string[] => {
    const misspellings = findMisspelled(text, languages);
    return misspellings.map(m => m.word);
  }, [languages, findMisspelled]);

  // Get suggestions for a specific word
  const getSuggestions = useCallback((word: string): string[] => {
    const cleanWord = word.replace(/[''']/g, "'");
    for (const lang of languages) {
      if (spellChecker.isReady(lang)) {
        const suggestions = spellChecker.instances.get(lang)?.suggest(cleanWord) || [];
        if (suggestions.length > 0) {
          return suggestions.slice(0, 5);
        }
      }
    }
    return [];
  }, [languages]);

  return {
    isLoading,
    misspelledWords,
    checkText,
    checkTextSync,
    getSuggestions,
    isReady,
    loadedLanguages: loadedLanguagesRef.current,
  };
}
