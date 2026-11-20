import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { spellEngine } from './spellEngine';
import { loadSpellDictionaryWords } from './spellPersonalDictionary';
import { findWords, shouldSkipWord } from './spellText';
import { useAppSettingsStore } from '../../../store/appSettingsStore';

const spellCheckKey = new PluginKey<DecorationSet>('aetheriaSpellCheck');

export interface SpellCheckOptions {
  /** Espera antes de volver a comprobar el texto, en milisegundos. */
  debounceMs: number;
}

/**
 * Calcula los subrayados de error para un documento.
 *
 * Los errores se marcan como decoraciones de ProseMirror sobre el texto real,
 * no sobre una capa duplicada por encima: asi los subrayados se mueven con el
 * contenido, con el cursor y con las menciones.
 */
function computeDecorations(doc: ProseMirrorNode): DecorationSet {
  if (!spellEngine.isEnabled() || !spellEngine.isReady()) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    for (const match of findWords(node.text)) {
      if (shouldSkipWord(match.word)) continue;
      if (spellEngine.check(match.word)) continue;
      decorations.push(
        Decoration.inline(pos + match.start, pos + match.end, { class: 'spell-error' })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/** Repinta los subrayados del editor con el estado actual del motor. */
export function refreshSpellDecorations(editor: Editor | null): void {
  if (!editor || editor.isDestroyed) return;
  const decorations = computeDecorations(editor.state.doc);
  editor.view.dispatch(editor.state.tr.setMeta(spellCheckKey, decorations));
}

/**
 * Extension que señala los errores ortograficos del texto.
 *
 * El analisis se retrasa unos milisegundos para no competir con el tecleo:
 * mientras el usuario escribe, la comprobacion espera a que pare.
 */
export const SpellCheck = Extension.create<SpellCheckOptions>({
  name: 'spellCheck',

  addOptions() {
    return { debounceMs: 400 };
  },

  addStorage() {
    return {
      unsubscribe: null as (() => void) | null,
    };
  },

  onCreate() {
    // El corrector se prepara en segundo plano: los diccionarios se cargan
    // solo cuando hacen falta y su analisis no bloquea la interfaz.
    void spellEngine.ensureLoaded();

    // Las palabras que el corrector debe respetar (diccionario personal y
    // nombres de la novela) dependen del proyecto abierto.
    void loadSpellDictionaryWords({
      useUniverseNames: useAppSettingsStore.getState().settings.spellCheckUseUniverseNames,
    });

    this.storage.unsubscribe = spellEngine.onChange(() => {
      refreshSpellDecorations(this.editor);
    });
  },

  onDestroy() {
    this.storage.unsubscribe?.();
    this.storage.unsubscribe = null;
  },

  addProseMirrorPlugins() {
    const extension = this;
    let timer: number | undefined;

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        refreshSpellDecorations(extension.editor);
      }, extension.options.debounceMs);
    };

    return [
      new Plugin<DecorationSet>({
        key: spellCheckKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, value) => {
            const incoming = tr.getMeta(spellCheckKey) as DecorationSet | undefined;
            if (incoming) return incoming;
            if (tr.docChanged) {
              schedule();
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return spellCheckKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
