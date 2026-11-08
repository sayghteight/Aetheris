import type { Editor } from '@tiptap/core';

/**
 * Una palabra del texto: letras (con diacriticos combinantes) y los apostrofos
 * y guiones que se quedan pegados a la palabra ("d'Argental", "cielo-cielo").
 */
export const WORD_PATTERN = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;

export interface WordMatch {
  /** Texto de la palabra tal cual aparece. */
  word: string;
  /** Desplazamiento de la palabra dentro del texto. */
  start: number;
  /** Desplazamiento final (exclusivo) de la palabra dentro del texto. */
  end: number;
}

/** Devuelve todas las palabras de un fragmento de texto, en orden. */
export function findWords(text: string): WordMatch[] {
  const matches: WordMatch[] = [];
  const pattern = new RegExp(WORD_PATTERN.source, 'gu');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return matches;
}

/**
 * Palabras que no conviene comprobar.
 *
 * - Las de una sola letra: `a`, `y`, `o`... aparecen en casi todas las frases
 *   y no todos los diccionarios las incluyen igual.
 * - Las que van todas en mayusculas: en una novela los dialogos en voz alta
 *   se escriben en mayusculas y las siglas son constantes, de modo que
 *   marcarlas como error daria un falso positivo constante.
 */
export function shouldSkipWord(word: string): boolean {
  if (word.length < 2) return true;
  if (word === word.toUpperCase()) return true;
  return false;
}

export interface SelectedWord {
  /** Texto de la palabra. */
  word: string;
  /** Posicion inicial de la palabra en el documento. */
  from: number;
  /** Posicion final de la palabra en el documento. */
  to: number;
}

/**
 * Palabra que hay bajo el cursor, con sus posiciones en el documento.
 * Devuelve `null` si el cursor no esta sobre texto.
 */
export function wordAtSelection(editor: Editor): SelectedWord | null {
  const { $from } = editor.state.selection;
  const parent = $from.parent;
  const offset = $from.parentOffset;

  // Ojo: `$from.parent` es el bloque (el parrafo), no el nodo de texto.
  // ProseMirror corta la resolucion al llegar a un nodo de texto, asi que
  // hay que localizar a mano el hijo que contiene la posicion. Puede haber
  // varios hijos: por ejemplo, una mencion seguida de texto.
  let text: string | null = null;
  let textStart = 0;
  let localOffset = 0;

  parent.forEach((child, childOffset) => {
    if (!child.isText) return;
    if (offset < childOffset || offset > childOffset + child.nodeSize) return;
    text = child.textContent;
    textStart = $from.start() + childOffset;
    localOffset = offset - childOffset;
  });

  if (text === null) return null;

  for (const match of findWords(text)) {
    // Se acepta el cursor al final de la palabra: si estas escribiendo, la
    // palabra que quieres corregir es la que acabas de teclear.
    if (localOffset >= match.start && localOffset <= match.end) {
      return {
        word: match.word,
        from: textStart + match.start,
        to: textStart + match.end,
      };
    }
  }
  return null;
}
