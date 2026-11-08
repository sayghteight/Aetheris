import type Typo from 'typo-js';

/** Idiomas con diccionario propio. */
export type SpellLanguage = 'es' | 'en';

/**
 * Constructor de Typo. Se declara aqui porque el paquete no incluye tipos y
 * `import type` no permite consultar el valor con `typeof`.
 */
type TypoConstructorType = new (
  dictionary?: string,
  affData?: string,
  wordsData?: string,
  settings?: {
    asyncLoad?: boolean;
    loadedCallback?: (typo: Typo) => void;
  }
) => Typo;

export interface SpellEngineState {
  /** El corrector esta activo. */
  enabled: boolean;
  /** Hay al menos un diccionario analizado y listo para consultar. */
  ready: boolean;
  /** Idiomas con los que se esta comprobando el texto. */
  languages: SpellLanguage[];
}

/**
 * Formas en las que se registra una palabra propia en la tabla del
 * diccionario. Hunspell guarda la palabra tal cual y luego prueba variantes
 * de capitalizacion, asi que basta con anadir la forma exacta y la minuscula
 * para cubrir "Aelthirion", "aelthirion" y "AELTHIRION".
 */
function wordForms(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];
  const lower = clean.toLowerCase();
  const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  return Array.from(new Set([clean, lower, capitalized]));
}

/**
 * Motor de correccion ortografica.
 *
 * Envuelve a Typo.js (Hunspell) y centraliza lo que la libreria no ofrece:
 * carga perezosa de los diccionarios, varios idiomas a la vez, palabras
 * propias (nombres del universo, diccionario personal) y un aviso de cambios
 * para que la extension del editor pueda repintar los subrayados.
 */
export class SpellEngine {
  private instances = new Map<SpellLanguage, Typo>();
  private readyLanguages = new Set<SpellLanguage>();
  private extraWords = new Set<string>();
  private languages: SpellLanguage[] = ['es'];
  private enabled = true;
  private loading: Promise<void> | null = null;
  private listeners = new Set<(state: SpellEngineState) => void>();

  get state(): SpellEngineState {
    return {
      enabled: this.enabled,
      ready: this.isReady(),
      languages: [...this.languages],
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** `true` cuando todos los diccionarios ya estan analizados. */
  isReady(): boolean {
    if (this.instances.size === 0) return false;
    for (const language of this.instances.keys()) {
      if (!this.readyLanguages.has(language)) return false;
    }
    return true;
  }

  /** `true` mientras se estan descargando o analizando los diccionarios. */
  isLoading(): boolean {
    return this.loading !== null && !this.isReady();
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.notify();
  }

  setLanguages(languages: SpellLanguage[]): void {
    const unique = Array.from(new Set(languages.filter((l) => l === 'es' || l === 'en')));
    if (unique.length === 0) unique.push('es');
    const same =
      unique.length === this.languages.length && unique.every((l, i) => l === this.languages[i]);
    if (same) return;

    this.languages = unique;
    // Los diccionarios cargados corresponden a otros idiomas: se descartan y
    // se vuelven a preparar los nuevos.
    this.instances.clear();
    this.readyLanguages.clear();
    this.loading = null;
    void this.ensureLoaded();
    this.notify();
  }

  /**
   * Palabras que siempre se consideran correctas: los nombres del universo y
   * las que el usuario ha anadido a su diccionario personal.
   */
  setExtraWords(words: string[]): void {
    this.extraWords = new Set(
      words
        .map((word) => word.trim().toLowerCase())
        .filter((word) => word.length > 0)
    );
    this.applyExtraWords();
    this.notify();
  }

  /** Anade una palabra propia al diccionario en memoria. */
  addWord(word: string): void {
    const clean = word.trim();
    if (!clean) return;
    this.extraWords.add(clean.toLowerCase());
    this.applyExtraWords();
    this.notify();
  }

  /** Palabras propias registradas actualmente. */
  getExtraWords(): string[] {
    return Array.from(this.extraWords);
  }

  /**
   * Prepara los diccionarios. Es idempotente: varias llamadas devuelven la
   * misma carga. El analisis de Hunspell se hace por bloques cediendo el
   * control al navegador, de forma que la interfaz no se congela mientras se
   * prepara el diccionario.
   */
  async ensureLoaded(): Promise<void> {
    if (this.instances.size > 0) return;
    if (!this.loading) {
      this.loading = this.load();
    }
    await this.loading;
  }

  /**
   * `true` si la palabra esta bien escrita. Si el diccionario todavia no esta
   * listo se responde `true`: es preferible no marcar nada antes que marcar
   * todo el texto como error.
   */
  check(word: string): boolean {
    if (!this.enabled) return true;
    const clean = word.trim();
    if (!clean) return true;
    if (this.extraWords.has(clean.toLowerCase())) return true;

    let anyReady = false;
    for (const instance of this.instances.values()) {
      if (!instance.loaded) continue;
      anyReady = true;
      try {
        if (instance.check(clean)) return true;
      } catch {
        // Typo lanza si el diccionario no esta cargado; se ignora y se sigue
        // con el resto de idiomas.
      }
    }
    return !anyReady;
  }

  /**
   * Correcciones sugeridas para una palabra. Es una operacion cara (busca
   * por distancia de edicion), asi que solo se pide para la palabra sobre la
   * que el usuario ha hecho clic derecho.
   */
  suggest(word: string, limit = 5): string[] {
    if (!this.enabled) return [];
    const clean = word.trim();
    if (!clean) return [];
    if (this.extraWords.has(clean.toLowerCase())) return [];

    const result: string[] = [];
    const seen = new Set<string>();
    for (const instance of this.instances.values()) {
      if (!instance.loaded) continue;
      let suggestions: string[] = [];
      try {
        suggestions = instance.suggest(clean, limit);
      } catch {
        continue;
      }
      for (const suggestion of suggestions) {
        if (seen.has(suggestion)) continue;
        seen.add(suggestion);
        result.push(suggestion);
        if (result.length >= limit) return result;
      }
    }
    return result;
  }

  /** Se avisa a los suscriptores cuando cambia el estado del motor. */
  onChange(listener: (state: SpellEngineState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('[spell] fallo en un suscriptor del corrector:', error);
      }
    }
  }

  private async load(): Promise<void> {
    const [dictionaries, typoModule] = await Promise.all([
      import('./spellDictionaries'),
      import('typo-js'),
    ]);

    const TypoConstructor =
      (typoModule as { default?: TypoConstructorType }).default ??
      (typoModule as unknown as TypoConstructorType);

    // Se cede un turno al navegador para que pueda pintar antes de que el
    // analisis del diccionario bloquee el hilo.
    await new Promise((resolve) => setTimeout(resolve, 0));

    for (const language of this.languages) {
      const data = dictionaries.DICTIONARIES[language];
      if (!data) continue;

      // Sin `asyncLoad`: Typo reparte el analisis entre callbacks de
      // `requestIdleCallback`, y en Chromium cada callback llega con el
      // presupuesto de tiempo ya consumido, de modo que solo avanza un bloque
      // de 64 palabras y la carga tarda mas de diez segundos. Analizado de
      // una vez son unos 600 ms, una sola vez por sesion.
      const instance = new TypoConstructor(language, data.aff, data.dic);

      this.instances.set(language, instance);
      this.readyLanguages.add(language);
    }

    this.applyExtraWords();
    this.notify();
  }

  /**
   * Registra las palabras propias en la tabla de cada diccionario. Una
   * entrada con valor `null` significa "esta en el diccionario pero sin
   * banderas de afijos", que es como Hunspell representa una palabra sin
   * reglas: el motor la dara por correcta.
   */
  private applyExtraWords(): void {
    for (const instance of this.instances.values()) {
      for (const word of this.extraWords) {
        for (const form of wordForms(word)) {
          instance.dictionaryTable.set(form, null);
        }
      }
      // Las sugerencias estan cacheadas por palabra: hay que vaciar la cache
      // para que una palabra anadida al instante pueda aparecer como opcion.
      for (const key of Object.keys(instance.memoized)) {
        delete instance.memoized[key];
      }
    }
  }
}

/** Instancia unica del motor, compartida por todos los editores. */
export const spellEngine = new SpellEngine();
