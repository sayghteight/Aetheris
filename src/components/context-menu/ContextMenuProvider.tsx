import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useI18n } from '../../i18n';
import { ContextMenuItem, ContextMenuScope } from './types';
import {
  buildEditableItems,
  captureEditableSelection,
  EditableSelection,
  findEditableElement,
  runEditableAction,
} from './textActions';

interface ContextMenuApi {
  /**
   * Registra un ambito de menu contextual y devuelve la funcion para
   * desregistrarlo. El ambito se consulta en cada clic derecho.
   */
  registerScope: (scope: ContextMenuScope) => () => void;
}

const ContextMenuContext = createContext<ContextMenuApi | null>(null);

export const useContextMenuScope = (): ContextMenuApi => {
  const api = useContext(ContextMenuContext);
  if (!api) {
    throw new Error('useContextMenuScope debe usarse dentro de <ContextMenuProvider>');
  }
  return api;
};

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  run: (itemId: string) => void | boolean | Promise<void | boolean>;
  /** Aviso que se muestra al pie del menu (por ejemplo, si no se pudo pegar). */
  notice?: string;
}

const MENU_MARGIN = 8;

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const scopesRef = useRef<ContextMenuScope[]>([]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const registerScope = useCallback((scope: ContextMenuScope) => {
    scopesRef.current = [...scopesRef.current, scope];
    return () => {
      scopesRef.current = scopesRef.current.filter((s) => s.id !== scope.id);
    };
  }, []);

  const api = useMemo<ContextMenuApi>(() => ({ registerScope }), [registerScope]);

  /**
   * Elemento que tenia el foco antes de abrir el menu. Al cerrarlo se le
   * devuelve el foco, porque el menu se renderiza fuera del editor y de otro
   * modo el usuario perderia el cursor al terminar de usar una accion.
   */
  const focusRestoreRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    focusRestoreRef.current = null;
    setMenu(null);
    setActiveIndex(-1);
  }, []);

  /**
   * Cierra el menu devolviendo el foco a donde estaba. Se usa tras ejecutar
   * una accion y al pulsar Escape: en ambos casos el usuario quiere volver al
   * punto de edicion. En cambio, si el menu se cierra porque el usuario ha
   * hecho clic en otro sitio, el foco debe quedarse alli.
   */
  const closeAndRestoreFocus = useCallback(() => {
    const restore = focusRestoreRef.current;
    close();
    if (restore && document.contains(restore)) {
      restore.focus({ preventScroll: true });
    }
  }, [close]);

  /**
   * Suprime el menu contextual nativo en todo el documento.
   *
   * En Windows el menu nativo de WebView2 ya esta desactivado en la capa de
   * Rust, pero este `preventDefault` cubre ademas Linux y macOS y garantiza que
   * el menu nativo nunca se solape con el de Aetheris.
   */
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      // Otra zona ya lo ha gestionado (p. ej. el arbol del manuscrito): no
      // interferimos ni abrimos un segundo menu.
      if (event.defaultPrevented) return;

      event.preventDefault();

      const target = event.target as Node | null;
      if (!target) return;

      const scope = scopesRef.current.find((candidate) => {
        try {
          return candidate.matches(target);
        } catch {
          return false;
        }
      });

      focusRestoreRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      itemRefs.current = [];

      if (scope) {
        const items = scope.build();
        if (items.length === 0) return;
        setActiveIndex(-1);
        setMenu({ x: event.clientX, y: event.clientY, items, run: scope.run });
        return;
      }

      // Fuera del editor: acciones basicas de edicion para los campos de texto.
      const editable = findEditableElement(target);
      if (!editable) return;

      const snapshot: EditableSelection = captureEditableSelection(editable);

      setActiveIndex(-1);
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: buildEditableItems(editable, t),
        run: (itemId) => runEditableAction(itemId, editable, snapshot),
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [t]);

  /**
   * Mantiene el menu dentro de los limites de la ventana. Se mide con el menu
   * en el origen y se corrige antes de pintar para que no se vea el salto.
   */
  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;

    const el = menuRef.current;
    el.style.left = '0px';
    el.style.top = '0px';

    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - MENU_MARGIN;
    const maxTop = window.innerHeight - rect.height - MENU_MARGIN;

    const left = Math.min(Math.max(MENU_MARGIN, menu.x), Math.max(MENU_MARGIN, maxLeft));
    const top = Math.min(Math.max(MENU_MARGIN, menu.y), Math.max(MENU_MARGIN, maxTop));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    // El contenedor recibe el foco para que las flechas funcionen sin obligar
    // a mover el foco a un elemento concreto.
    el.focus({ preventScroll: true });
  }, [menu]);

  // Cierre: clic fuera, Escape y cualquier cambio de tamano o desplazamiento.
  useEffect(() => {
    if (!menu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeAndRestoreFocus();
      }
    };
    const handleViewportChange = () => close();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [menu, close, closeAndRestoreFocus]);

  const actionableItems = useMemo(
    () => (menu ? menu.items.filter((item) => !item.separator) : []),
    [menu]
  );

  const focusItem = useCallback(
    (index: number) => {
      if (actionableItems.length === 0) return;
      const next = (index + actionableItems.length) % actionableItems.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    },
    [actionableItems.length]
  );

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(actionableItems.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closeAndRestoreFocus();
        break;
      default:
        break;
    }
  };

  const handleAction = async (item: ContextMenuItem) => {
    if (item.disabled) return;

    const run = menu?.run;
    if (!run) {
      closeAndRestoreFocus();
      return;
    }

    const result = run(item.id);
    const ok = result instanceof Promise ? await result : result;

    if (ok === false) {
      // La accion no se pudo completar (pegar sin acceso al portapapeles).
      // El menu permanece abierto para poder mostrar el aviso.
      setMenu((current) =>
        current ? { ...current, notice: t('contextMenu.pasteUnavailable') } : current
      );
      return;
    }

    closeAndRestoreFocus();
  };

  let actionableIndex = -1;

  return (
    <ContextMenuContext.Provider value={api}>
      {children}

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          aria-label={t('contextMenu.label')}
          onKeyDown={handleMenuKeyDown}
          onContextMenu={(event) => event.preventDefault()}
          className="fixed z-[9999] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 min-w-[200px] outline-none overflow-hidden"
          style={{ left: 0, top: 0 }}
        >
          {menu.items.map((item, index) => {
            if (item.separator) {
              return <div key={`sep-${index}`} role="separator" className="h-px bg-[var(--color-border)] my-1" />;
            }

            actionableIndex += 1;
            const currentIndex = actionableIndex;

            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[currentIndex] = node;
                }}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => handleAction(item)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  item.disabled
                    ? 'text-[var(--color-text-muted)] cursor-not-allowed'
                    : item.danger
                    ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[var(--color-text-muted)] text-xs">{item.shortcut}</span>
                )}
              </button>
            );
          })}

          {menu.notice && (
            <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] mt-1">
              {menu.notice}
            </div>
          )}
        </div>
      )}
    </ContextMenuContext.Provider>
  );
};
