import { useEffect, useCallback, useRef } from 'react';
import { useShortcutsStore, ShortcutAction } from '../store/shortcutsStore';

export type ShortcutHandler = (action: ShortcutAction) => void;

interface ShortcutHandlers {
  onSave?: () => void;
  onBold?: () => void;
  onItalic?: () => void;
  onUnderline?: () => void;
  onStrikethrough?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onFormatBlock?: () => void;
}

export const useKeyboardShortcuts = (
  handlers: ShortcutHandlers,
  enabled: boolean = true
) => {
  const { shortcuts, normalizeEvent } = useShortcutsStore();
  const handlersRef = useRef(handlers);

  // Keep handlers ref current
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs/textareas (except for specific actions)
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      const normalized = normalizeEvent(e);
      if (!normalized) return;

      const { key, modifiers } = normalized;

      // Check each action's shortcut
      for (const [action, shortcut] of Object.entries(shortcuts)) {
        if (
          shortcut.key.toLowerCase() === key &&
          shortcut.modifiers.length === modifiers.length &&
          shortcut.modifiers.every((m) => modifiers.includes(m))
        ) {
          // Found matching shortcut
          const handler = handlersRef.current[
            action as keyof ShortcutHandlers
          ] as ShortcutHandler | undefined;

          if (handler) {
            // Block browser's default find (Ctrl+F, Ctrl+H) by preventing default
            // Allow all shortcuts in textareas since they either:
            // - Open dialogs (find, replace) that don't modify content
            // - Apply formatting (bold, italic) which work via execCommand/wrap
            if (isEditable) {
              e.preventDefault();
              e.stopPropagation();
              handler(action as ShortcutAction);
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            handler(action as ShortcutAction);
            return;
          }
        }
      }
    },
    [enabled, shortcuts, normalizeEvent]
  );

  useEffect(() => {
    // Use capture phase to intercept before browser defaults (e.g. Ctrl+F search)
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);
};
