import type { ContextMenuItem } from './types';

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export const TEXT_ACTION_IDS = {
  cut: 'cut',
  copy: 'copy',
  paste: 'paste',
  selectAll: 'selectAll',
} as const;

/** Tipos de <input> que no contienen texto editable. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditableElement(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  }
  if (tag === 'TEXTAREA') return true;
  return el.isContentEditable;
}

/** Sube por el arbol hasta encontrar el campo de texto editable que contiene `node`. */
export function findEditableElement(node: Node | null): HTMLElement | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : ((node as HTMLElement | null)?.parentElement ?? null);

  while (el) {
    if (isEditableElement(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/** Instantanea de la seleccion para poder restaurarla tras abrir el menu. */
export interface EditableSelection {
  range: Range | null;
  inputStart: number | null;
  inputEnd: number | null;
}

export function captureEditableSelection(el: HTMLElement): EditableSelection {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return {
      range: null,
      inputStart: el.selectionStart,
      inputEnd: el.selectionEnd,
    };
  }

  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 && selection.toString().length > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;

  return { range, inputStart: null, inputEnd: null };
}

export function restoreEditableSelection(el: HTMLElement, snapshot: EditableSelection): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (snapshot.inputStart !== null && snapshot.inputEnd !== null) {
      try {
        el.setSelectionRange(snapshot.inputStart, snapshot.inputEnd);
      } catch {
        // Algunos tipos de input no admiten setSelectionRange: lo ignoramos.
      }
    }
    return;
  }

  if (snapshot.range) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(snapshot.range);
  }
}

export function hasTextSelection(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.selectionStart !== el.selectionEnd;
  }
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && selection.toString().length > 0;
}

/** Inserta texto en la posicion actual del cursor de un campo editable. */
export function insertTextAtCursor(el: HTMLElement, text: string): void {
  el.focus();

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(text, start, end, 'end');
    // React no controla el valor del input de forma nativa: hay que avisarle.
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  document.execCommand('insertText', false, text);
}

/**
 * Pega el contenido del portapapeles en un campo editable.
 *
 * `document.execCommand('paste')` esta bloqueado para el contenido web por
 * motivos de seguridad, asi que se usa la API asincrona del portapapeles, que
 * WebView2 permite en la ventana enfocada. Como respaldo se intenta tambien
 * `execCommand('paste')`, que funciona en algunas configuraciones.
 */
export async function pasteIntoEditable(el: HTMLElement): Promise<boolean> {
  try {
    const text = await navigator.clipboard.readText();
    insertTextAtCursor(el, text);
    return true;
  } catch {
    // Sin permiso de lectura o sin API asincrona: probamos con el metodo antiguo.
  }

  try {
    el.focus();
    if (document.execCommand('paste')) return true;
  } catch {
    // execCommand('paste') esta bloqueado en la practica.
  }

  return false;
}

/** Selecciona todo el contenido de un campo editable. */
export function selectAllIn(el: HTMLElement): void {
  el.focus();

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
    return;
  }

  document.execCommand('selectAll');
}

/** Acciones de edicion basicas (cortar / copiar / pegar / seleccionar todo). */
export function buildEditableItems(el: HTMLElement, t: TranslateFn): ContextMenuItem[] {
  const hasSelection = hasTextSelection(el);

  return [
    {
      id: TEXT_ACTION_IDS.cut,
      label: t('contextMenu.cut'),
      disabled: !hasSelection,
    },
    {
      id: TEXT_ACTION_IDS.copy,
      label: t('contextMenu.copy'),
      disabled: !hasSelection,
    },
    {
      id: TEXT_ACTION_IDS.paste,
      label: t('contextMenu.paste'),
    },
    {
      id: TEXT_ACTION_IDS.selectAll,
      label: t('contextMenu.selectAll'),
    },
  ];
}

/**
 * Ejecuta una accion de edicion basica sobre un campo editable.
 * Devuelve `false` si la accion no se pudo completar (por ejemplo, pegar).
 */
export async function runEditableAction(
  id: string,
  el: HTMLElement,
  snapshot?: EditableSelection | null
): Promise<boolean> {
  switch (id) {
    case TEXT_ACTION_IDS.cut: {
      el.focus();
      if (snapshot) restoreEditableSelection(el, snapshot);
      document.execCommand('cut');
      return true;
    }
    case TEXT_ACTION_IDS.copy: {
      el.focus();
      if (snapshot) restoreEditableSelection(el, snapshot);
      document.execCommand('copy');
      return true;
    }
    case TEXT_ACTION_IDS.paste: {
      if (snapshot) restoreEditableSelection(el, snapshot);
      return pasteIntoEditable(el);
    }
    case TEXT_ACTION_IDS.selectAll: {
      if (snapshot) restoreEditableSelection(el, snapshot);
      selectAllIn(el);
      return true;
    }
    default:
      return false;
  }
}
