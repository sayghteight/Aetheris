import { diffWordsWithSpace } from 'diff';

/** Tipo de cada fragmento del diff. */
export type DiffType = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  value: string;
  type: DiffType;
}

export interface RevisionDiff {
  /** Fragmentos del texto, en orden. */
  segments: DiffSegment[];
  /** Palabras anadidas (solo en el texto nuevo). */
  addedWords: number;
  /** Palabras eliminadas (solo en el texto viejo). */
  removedWords: number;
}

/**
 * Convierte el HTML que guarda el editor en texto plano conservando los
 * saltos de linea entre parrafos.
 *
 * Se usa el mismo criterio con el que el frontend guarda `plain_text`
 * (las etiquetas se sustituyen por un espacio), de modo que el texto de una
 * revision y el de la escena actual son comparables.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|pre|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Cuenta palabras de un fragmento, sin contar los espacios sobrantes. */
function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Compara dos textos palabra a palabra, como hace `git diff --word-diff`:
 * lo que solo esta en el texto viejo aparece como eliminado y lo que solo
 * esta en el nuevo, como anadido.
 *
 * @param baseText Texto de partida (el mas antiguo).
 * @param targetText Texto de llegada (el mas reciente).
 */
export function buildRevisionDiff(baseText: string, targetText: string): RevisionDiff {
  const changes = diffWordsWithSpace(baseText, targetText);

  const segments: DiffSegment[] = [];
  let addedWords = 0;
  let removedWords = 0;

  for (const change of changes) {
    let type: DiffType = 'equal';
    if (change.added) {
      type = 'added';
      addedWords += countWords(change.value);
    } else if (change.removed) {
      type = 'removed';
      removedWords += countWords(change.value);
    }
    segments.push({ value: change.value, type });
  }

  return { segments, addedWords, removedWords };
}
