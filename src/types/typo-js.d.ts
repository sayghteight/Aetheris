/**
 * Declaraciones del motor de correccion ortografica Typo.js.
 *
 * El paquete no incluye tipos, asi que se declaran aqui los metodos que usa
 * Aetheris. `dictionaryTable` y `memoized` son internos de la libreria: se usan
 * para anadir palabras propias y para invalidar la cache de sugerencias, y
 * por eso quedan encapsulados en `spellEngine.ts`.
 */
declare module 'typo-js' {
  export interface TypoSettings {
    /** Analiza el diccionario sin bloquear el hilo principal. */
    asyncLoad?: boolean;
    /** Se llama cuando el diccionario ha terminado de analizarse. */
    loadedCallback?: (typo: Typo) => void;
  }

  export default class Typo {
    constructor(
      dictionary?: string,
      affData?: string,
      wordsData?: string,
      settings?: TypoSettings
    );

    /** Codigo de idioma con el que se creo la instancia. */
    readonly dictionary: string;
    /** `true` cuando el diccionario ya esta analizado y se puede consultar. */
    readonly loaded: boolean;
    /**
     * Tabla de palabras del diccionario. El valor son los flags de afijos
     * asociados a la palabra, o `null` si la palabra esta en el diccionario
     * pero sin flags. Anadir entradas con `null` hace que la palabra se
     * considere correctamente escrita.
     */
    dictionaryTable: Map<string, string[] | null>;
    /**
     * Cache de sugerencias ya calculadas. La libreria usa `hasOwnProperty`
     * sobre este objeto, asi que hay que vaciarlo borrando las claves, no
     * sustituyendolo por un objeto sin prototipo.
     */
    memoized: Record<string, { suggestions: string[]; limit: number }>;

    /** `true` si la palabra esta escrita correctamente. */
    check(word: string): boolean;
    /** Lista de correcciones sugeridas para la palabra. */
    suggest(word: string, limit?: number): string[];
  }
}
