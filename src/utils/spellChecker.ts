/**
 * Spell Checker Service
 *
 * NOTA: el corrector ortografico nativo de WebView2 esta desactivado en
 * Aetheris (el editor usa `spellcheck="false"` y el menu contextual nativo se
 * desactiva en la capa de Rust). Este servicio sigue siendo un stub sin usar:
 * no comprueba nada y no devuelve sugerencias. Para tener corrector ortografico
 * hay que implementar un motor propio, no relies en el del navegador.
 */

export interface SpellCheckerService {
  isAvailable: (lang: string) => boolean;
  getAvailableLanguages: () => string[];
  getLanguageName: (lang: string) => string;
  isReady: (lang: string) => boolean;
  checkWord: (word: string, langs: string[]) => Promise<boolean>;
  checkWordSync: (word: string, lang: string) => boolean;
  getSuggestions: (word: string, lang: string) => Promise<string[]>;
  checkTextSync: (text: string, langs: string[]) => string[];
  instances: Map<string, any>;
}

const AVAILABLE_LANGUAGES: Record<string, string> = {
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

class SpellCheckerServiceImpl implements SpellCheckerService {
  instances: Map<string, any> = new Map();

  isAvailable(_lang: string): boolean {
    return true;
  }

  getAvailableLanguages(): string[] {
    return Object.keys(AVAILABLE_LANGUAGES);
  }

  getLanguageName(lang: string): string {
    return AVAILABLE_LANGUAGES[lang] || lang;
  }

  isReady(_lang: string): boolean {
    return true;
  }

  async checkWord(_word: string, _langs: string[]): Promise<boolean> {
    // Browser handles spell checking natively
    return true;
  }

  checkWordSync(_word: string, _lang: string): boolean {
    // Browser handles spell checking natively
    return true;
  }

  async getSuggestions(_word: string, _lang: string): Promise<string[]> {
    // Browser handles suggestions via context menu
    return [];
  }

  checkTextSync(_text: string, _langs: string[]): string[] {
    // Browser handles spell checking natively
    return [];
  }

  unload(_lang: string): void {}

  unloadAll(): void {}
}

export const spellChecker = new SpellCheckerServiceImpl();
