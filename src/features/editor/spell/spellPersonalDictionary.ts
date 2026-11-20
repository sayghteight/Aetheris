import { invoke } from '@tauri-apps/api/core';
import { spellEngine } from './spellEngine';

export interface PersonalDictionaryWord {
  word: string;
  language: string;
  createdAt: string;
}

export interface SpellDictionaryOptions {
  /** Si los nombres de la novela se consideran palabras correctas. */
  useUniverseNames: boolean;
}

/**
 * Palabras que el corrector no debe marcar como error.
 *
 * Se compone de dos fuentes: el diccionario personal de la novela (lo que el
 * usuario anade a mano) y los nombres de la obra (personajes, lugares y
 * objetos), que en una novela son medio diccionario.
 */
let knownWords: string[] = [];
let pending: Promise<void> | null = null;
/** Ultima opcion aplicada, para recargar sin perderla. */
let lastOptions: SpellDictionaryOptions = { useUniverseNames: true };

/**
 * Trocea un nombre en las palabras que lo componen.
 *
 * El corrector comprueba palabra a palabra, asi que de "Valquiria de Eisen"
 * hay que sacar "Valquiria" y "Eisen". Se descartan los trozos muy cortos
 * para no tapar palabras comunes.
 */
function splitName(name: string): string[] {
  return name
    .split(/[^\p{L}\p{M}]+/u)
    .filter((part) => part.length >= 3);
}

/**
 * Carga las palabras que el corrector debe respetar y las registra en el
 * motor. Es idempotente: mientras hay una carga en curso se espera a esa.
 */
export function loadSpellDictionaryWords(
  options: SpellDictionaryOptions,
  force = false
): Promise<void> {
  if (pending && !force) return pending;

  pending = (async () => {
    const words: string[] = [];
    lastOptions = options;

    // Diccionario personal de la novela.
    try {
      const personal = await invoke<PersonalDictionaryWord[]>('get_personal_dictionary');
      for (const entry of personal ?? []) {
        words.push(...splitName(entry.word));
      }
    } catch (error) {
      console.error('[spell] no se pudo leer el diccionario personal:', error);
    }

    // Nombres de la novela: personajes, lugares, objetos y facciones.
    if (options.useUniverseNames) {
      try {
        const universe = await invoke<{ entries?: { name: string }[] }>('get_universe');
        for (const entry of universe?.entries ?? []) {
          words.push(...splitName(entry.name));
        }
      } catch (error) {
        console.error('[spell] no se pudieron leer los nombres de la novela:', error);
      }
    }

    knownWords = Array.from(new Set(words));
    spellEngine.setExtraWords(knownWords);
  })().finally(() => {
    pending = null;
  });

  return pending;
}

/** Palabras que el corrector respeta ahora mismo. */
export function getKnownSpellWords(): string[] {
  return knownWords;
}

/**
 * Anade una palabra al diccionario personal.
 *
 * Se registra primero en memoria, para que el subrayado desaparezca al
 * instante, y despues se guarda en la novela. Si el guardado falla, la
 * palabra sigue siendo valida durante la sesion.
 */
export async function addWordToPersonalDictionary(word: string): Promise<boolean> {
  const clean = word.trim();
  if (!clean) return false;

  spellEngine.addWord(clean);
  if (!knownWords.includes(clean)) {
    knownWords = [...knownWords, clean];
  }

  try {
    const language = spellEngine.state.languages[0] ?? 'es';
    await invoke('add_personal_dictionary_word', { word: clean, language });
    return true;
  } catch (error) {
    console.error('[spell] no se pudo guardar la palabra en el diccionario:', error);
    return false;
  }
}

/** Elimina una palabra del diccionario personal. */
export async function removeWordFromPersonalDictionary(word: string): Promise<boolean> {
  const clean = word.trim();
  if (!clean) return false;

  try {
    await invoke('remove_personal_dictionary_word', { word: clean });
    knownWords = knownWords.filter((entry) => entry !== clean);
    await loadSpellDictionaryWords(lastOptions, true);
    return true;
  } catch (error) {
    console.error('[spell] no se pudo eliminar la palabra del diccionario:', error);
    return false;
  }
}
