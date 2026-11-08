import { Editor } from '@tiptap/core';
import {
  Bold,
  ClipboardPaste,
  Copy,
  Italic,
  Redo,
  Scissors,
  Strikethrough,
  TextSelect,
  Underline as UnderlineIcon,
  Undo,
} from 'lucide-react';
import { ContextMenuItem } from '../../components/context-menu/types';
import {
  TEXT_ACTION_IDS,
  TranslateFn,
} from '../../components/context-menu/textActions';
import { spellEngine } from './spell/spellEngine';
import { wordAtSelection } from './spell/spellText';
import { addWordToPersonalDictionary } from './spell/spellPersonalDictionary';

export const EDITOR_CONTEXT_MENU_ID = 'tiptap-editor';

/** Prefijo de los identificadores de las sugerencias del corrector. */
const SPELL_SUGGESTION_PREFIX = 'spell-suggestion-';
/** Identificador de la accion de anadir la palabra al diccionario personal. */
const SPELL_ADD_WORD = 'spell-add-word';
/** Identificador del encabezado que muestra la palabra con error. */
const SPELL_HEADER = 'spell-header';

/** Acciones del corrector pendientes de ejecutar, por editor. */
interface PendingSpellAction {
  word: string;
  suggestion: string;
  from: number;
  to: number;
}

/**
 * El menu se construye al hacer clic y la accion se ejecuta despues, asi que
 * las sugerencias que se ofrecen tienen que quedar guardadas para poder
 * aplicarlas despues. Se guardan por editor para que dos editores abiertos no
 * se pisen.
 */
const pendingSpellActions = new WeakMap<Editor, Map<string, PendingSpellAction>>();

/**
 * Construye el bloque de sugerencias del corrector ortografico.
 *
 * Solo aparece si hay una palabra mal escrita bajo el cursor y el motor tiene
 * correcciones para ella.
 */
function buildSpellItems(editor: Editor, t: TranslateFn): ContextMenuItem[] {
  const pending = new Map<string, PendingSpellAction>();
  pendingSpellActions.set(editor, pending);

  if (!spellEngine.isEnabled() || !spellEngine.isReady()) return [];

  const selected = wordAtSelection(editor);
  if (!selected) return [];

  // Si la palabra esta bien escrita no hay nada que corregir.
  if (spellEngine.check(selected.word)) return [];

  const suggestions = spellEngine.suggest(selected.word, 5);
  if (suggestions.length === 0) return [];

  const items: ContextMenuItem[] = [
    { id: 'editor-separator-3', label: '', separator: true },
    {
      id: SPELL_HEADER,
      label: t('spellCheck.suggestionsFor', { word: selected.word }),
      disabled: true,
    },
  ];

  suggestions.forEach((suggestion, index) => {
    const id = `${SPELL_SUGGESTION_PREFIX}${index}`;
    pending.set(id, {
      word: selected.word,
      suggestion,
      from: selected.from,
      to: selected.to,
    });
    items.push({ id, label: suggestion });
  });

  pending.set(SPELL_ADD_WORD, {
    word: selected.word,
    suggestion: '',
    from: selected.from,
    to: selected.to,
  });

  items.push({ id: 'editor-separator-4', label: '', separator: true });
  items.push({
    id: SPELL_ADD_WORD,
    label: t('spellCheck.addWord', { word: selected.word }),
  });

  return items;
}

/**
 * Acciones del menu contextual del editor TipTap.
 *
 * Se combinan las operaciones de edicion basicas (que el menu nativo de
 * WebView2 ofrecia) con las acciones especificas del editor que ya existen en
 * la barra de herramientas y con las sugerencias del corrector.
 */
export function buildEditorContextMenuItems(
  editor: Editor,
  t: TranslateFn
): ContextMenuItem[] {
  const hasSelection = !editor.state.selection.empty;

  return [
    {
      id: TEXT_ACTION_IDS.cut,
      label: t('contextMenu.cut'),
      icon: <Scissors className="w-4 h-4" />,
      disabled: !hasSelection,
    },
    {
      id: TEXT_ACTION_IDS.copy,
      label: t('contextMenu.copy'),
      icon: <Copy className="w-4 h-4" />,
      disabled: !hasSelection,
    },
    {
      id: TEXT_ACTION_IDS.paste,
      label: t('contextMenu.paste'),
      icon: <ClipboardPaste className="w-4 h-4" />,
    },
    {
      id: TEXT_ACTION_IDS.selectAll,
      label: t('contextMenu.selectAll'),
      icon: <TextSelect className="w-4 h-4" />,
    },
    { id: 'editor-separator-1', label: '', separator: true },
    {
      id: 'undo',
      label: t('contextMenu.undo'),
      icon: <Undo className="w-4 h-4" />,
      shortcut: 'Ctrl+Z',
      disabled: !editor.can().undo(),
    },
    {
      id: 'redo',
      label: t('contextMenu.redo'),
      icon: <Redo className="w-4 h-4" />,
      shortcut: 'Ctrl+Y',
      disabled: !editor.can().redo(),
    },
    { id: 'editor-separator-2', label: '', separator: true },
    {
      id: 'bold',
      label: t('contextMenu.bold'),
      icon: <Bold className="w-4 h-4" />,
      shortcut: 'Ctrl+B',
      disabled: !editor.can().toggleBold(),
    },
    {
      id: 'italic',
      label: t('contextMenu.italic'),
      icon: <Italic className="w-4 h-4" />,
      shortcut: 'Ctrl+I',
      disabled: !editor.can().toggleItalic(),
    },
    {
      id: 'underline',
      label: t('contextMenu.underline'),
      icon: <UnderlineIcon className="w-4 h-4" />,
      shortcut: 'Ctrl+U',
      disabled: !editor.can().toggleUnderline(),
    },
    {
      id: 'strike',
      label: t('contextMenu.strikethrough'),
      icon: <Strikethrough className="w-4 h-4" />,
      disabled: !editor.can().toggleStrike(),
    },
    ...buildSpellItems(editor, t),
  ];
}

/**
 * Ejecuta la accion elegida del menu contextual del editor.
 *
 * Devuelve `false` unicamente cuando la accion no se pudo completar, para que
 * el menu pueda avisar al usuario.
 */
export async function runEditorContextMenuAction(
  id: string,
  editor: Editor
): Promise<boolean> {
  // Acciones del corrector ortografico.
  if (id.startsWith(SPELL_SUGGESTION_PREFIX) || id === SPELL_ADD_WORD) {
    const action = pendingSpellActions.get(editor)?.get(id);
    if (!action) return true;

    if (id === SPELL_ADD_WORD) {
      await addWordToPersonalDictionary(action.word);
      return true;
    }

    editor
      .chain()
      .focus()
      .insertContentAt({ from: action.from, to: action.to }, action.suggestion)
      .run();
    return true;
  }

  switch (id) {
    case TEXT_ACTION_IDS.cut:
      editor.chain().focus().run();
      return document.execCommand('cut');

    case TEXT_ACTION_IDS.copy:
      editor.chain().focus().run();
      return document.execCommand('copy');

    case TEXT_ACTION_IDS.paste:
      return pasteIntoEditor(editor);

    case TEXT_ACTION_IDS.selectAll:
      editor.chain().focus().selectAll().run();
      return true;

    case 'undo':
      editor.chain().focus().undo().run();
      return true;

    case 'redo':
      editor.chain().focus().redo().run();
      return true;

    case 'bold':
      editor.chain().focus().toggleBold().run();
      return true;

    case 'italic':
      editor.chain().focus().toggleItalic().run();
      return true;

    case 'underline':
      editor.chain().focus().toggleUnderline().run();
      return true;

    case 'strike':
      editor.chain().focus().toggleStrike().run();
      return true;

    default:
      return true;
  }
}

/**
 * Pega el texto del portapapeles en el editor.
 *
 * `document.execCommand('paste')` esta bloqueado para el contenido web, asi que
 * se lee el portapapeles con la API asincrona (que WebView2 permite con la
 * ventana enfocada) y se inserta como texto literal a traves de TipTap.
 */
async function pasteIntoEditor(editor: Editor): Promise<boolean> {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return true;

    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text })
      .run();

    return true;
  } catch {
    return false;
  }
}
