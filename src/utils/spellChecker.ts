/**
 * Spell Checker Service using Typo.js
 * Supports multiple languages with dictionaries loaded from CDN
 */

import Typo from 'typo-js';

export interface SpellCheckerInstance {
  check: (word: string) => boolean;
  suggest: (word: string) => string[];
}

export interface SpellCheckerService {
  instances: Map<string, SpellCheckerInstance>;
  isReady: (lang: string) => boolean;
  checkWord: (word: string, langs: string[]) => Promise<boolean>;
  getSuggestions: (word: string, lang: string) => Promise<string[]>;
  checkAll: (text: string, langs: string[]) => Promise<Map<string, string[]>>;
  unload: (lang: string) => void;
}

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/wooorm/typo-js@1.0.0/dictionaries';

const AVAILABLE_DICTIONARIES: Record<string, { name: string; aff?: string; dic?: string }> = {
  es: { name: 'es' },
  en: { name: 'en_US' },
  fr: { name: 'fr' },
  de: { name: 'de_DE' },
  it: { name: 'it' },
  pt: { name: 'pt_PT' },
  ca: { name: 'ca' },
  gl: { name: 'gl' },
  eu: { name: 'eu' },
};

class SpellCheckerServiceImpl implements SpellCheckerService {
  instances: Map<string, SpellCheckerInstance> = new Map();
  private loading: Map<string, Promise<void>> = new Map();

  /**
   * Check if a dictionary for the given language is available
   */
  isAvailable(lang: string): boolean {
    return lang in AVAILABLE_DICTIONARIES;
  }

  /**
   * Get available language codes
   */
  getAvailableLanguages(): string[] {
    return Object.keys(AVAILABLE_DICTIONARIES);
  }

  /**
   * Get display name for a language code
   */
  getLanguageName(lang: string): string {
    const names: Record<string, string> = {
      es: 'Español',
      en: 'English',
      fr: 'Français',
      de: 'Deutsch',
      it: 'Italiano',
      pt: 'Português',
      ca: 'Català',
      gl: 'Galego',
      eu: 'Euskara',
    };
    return names[lang] || lang;
  }

  /**
   * Load a dictionary for a specific language from CDN
   */
  async loadDictionary(lang: string): Promise<void> {
    if (this.instances.has(lang)) {
      return;
    }

    // If already loading, wait for it
    if (this.loading.has(lang)) {
      return this.loading.get(lang);
    }

    const dictInfo = AVAILABLE_DICTIONARIES[lang];
    if (!dictInfo) {
      console.warn(`Dictionary not available for language: ${lang}`);
      return;
    }

    const loadingPromise = (async () => {
      try {
        const affUrl = `${CDN_BASE}/${dictInfo.name}/${dictInfo.name}.aff`;
        const dicUrl = `${CDN_BASE}/${dictInfo.name}/${dictInfo.name}.dic`;

        const [affResponse, dicResponse] = await Promise.all([
          fetch(affUrl),
          fetch(dicUrl),
        ]);

        if (!affResponse.ok || !dicResponse.ok) {
          throw new Error(`Failed to load dictionary for ${lang}`);
        }

        const affData = await affResponse.text();
        const dicData = await dicResponse.text();

        const typo = new Typo(lang, affData, dicData);
        this.instances.set(lang, {
          check: (word: string) => typo.check(word),
          suggest: (word: string) => typo.suggest(word),
        });

        console.log(`Dictionary loaded for language: ${lang}`);
      } catch (error) {
        console.error(`Error loading dictionary for ${lang}:`, error);
        // Fallback: create a dummy instance that always returns true
        this.instances.set(lang, {
          check: () => true,
          suggest: () => [],
        });
      } finally {
        this.loading.delete(lang);
      }
    })();

    this.loading.set(lang, loadingPromise);
    return loadingPromise;
  }

  /**
   * Check if a dictionary is loaded and ready
   */
  isReady(lang: string): boolean {
    return this.instances.has(lang);
  }

  /**
   * Ensure a language dictionary is loaded
   */
  async ensureLoaded(lang: string): Promise<void> {
    if (!this.isReady(lang)) {
      await this.loadDictionary(lang);
    }
  }

  /**
   * Check if a single word is spelled correctly in any of the given languages
   */
  async checkWord(word: string, langs: string[]): Promise<boolean> {
    const cleanWord = word.replace(/[''']/g, "'").trim();
    if (!cleanWord) return true;

    // Check in all provided languages
    for (const lang of langs) {
      await this.ensureLoaded(lang);
      const instance = this.instances.get(lang);
      if (instance && instance.check(cleanWord)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check word synchronously (assumes dictionary is already loaded)
   */
  checkWordSync(word: string, lang: string): boolean {
    const instance = this.instances.get(lang);
    if (!instance) return true; // Assume correct if not loaded
    const cleanWord = word.replace(/[''']/g, "'").trim();
    return instance.check(cleanWord);
  }

  /**
   * Get spelling suggestions for a word
   */
  async getSuggestions(word: string, lang: string): Promise<string[]> {
    await this.ensureLoaded(lang);
    const instance = this.instances.get(lang);
    if (!instance) return [];
    const cleanWord = word.replace(/[''']/g, "'").trim();
    return instance.suggest(cleanWord);
  }

  /**
   * Check all words in text and return misspelled words with suggestions
   * Returns a Map of word -> suggestions
   */
  async checkAll(text: string, langs: string[]): Promise<Map<string, string[]>> {
    const words = text.match(/[\w''']+/g) || [];
    const misspellings = new Map<string, string[]>();
    const checkedWords = new Set<string>();

    for (const word of words) {
      const cleanWord = word.replace(/[''']/g, "'");
      if (checkedWords.has(cleanWord.toLowerCase())) continue;
      checkedWords.add(cleanWord.toLowerCase());

      const isCorrect = await this.checkWord(cleanWord, langs);
      if (!isCorrect) {
        // Get suggestions from the first language that has them
        for (const lang of langs) {
          const suggestions = await this.getSuggestions(cleanWord, lang);
          if (suggestions.length > 0) {
            misspellings.set(cleanWord, suggestions);
            break;
          }
        }
        // If no suggestions found, still mark as misspelled with empty array
        if (!misspellings.has(cleanWord)) {
          misspellings.set(cleanWord, []);
        }
      }
    }

    return misspellings;
  }

  /**
   * Check text synchronously (for performance during typing)
   * Returns array of misspelled words
   */
  checkTextSync(text: string, langs: string[]): string[] {
    const words = text.match(/[\w''']+/g) || [];
    const misspellings: string[] = [];
    const checkedWords = new Set<string>();

    for (const word of words) {
      const cleanWord = word.replace(/[''']/g, "'");
      if (checkedWords.has(cleanWord.toLowerCase())) continue;
      checkedWords.add(cleanWord.toLowerCase());

      let isCorrect = false;
      for (const lang of langs) {
        if (this.checkWordSync(cleanWord, lang)) {
          isCorrect = true;
          break;
        }
      }
      if (!isCorrect) {
        misspellings.push(cleanWord);
      }
    }

    return misspellings;
  }

  /**
   * Unload a dictionary to free memory
   */
  unload(lang: string): void {
    this.instances.delete(lang);
  }

  /**
   * Unload all dictionaries
   */
  unloadAll(): void {
    this.instances.clear();
  }
}

// Singleton instance
export const spellChecker = new SpellCheckerServiceImpl();
