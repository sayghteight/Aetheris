import React, { useState, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useShortcutsStore, Shortcut, ModifierKey } from '../store/shortcutsStore';

interface ShortcutRecorderProps {
  shortcut: Shortcut;
  onSave: (shortcut: Shortcut) => void;
  onCancel: () => void;
  conflictLabel?: string | null;
}

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  shortcut,
  onSave,
  onCancel,
  conflictLabel,
}) => {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [currentModifiers, setCurrentModifiers] = useState<ModifierKey[]>([]);
  const { formatShortcut } = useShortcutsStore();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();

      // Escape cancels recording
      if (e.key === 'Escape') {
        setRecording(false);
        setCurrentKey(null);
        setCurrentModifiers([]);
        onCancel();
        return;
      }

      // Only accept modifier keys alone to set modifiers
      const mods: ModifierKey[] = [];
      if (e.ctrlKey) mods.push('ctrl');
      if (e.altKey) mods.push('alt');
      if (e.shiftKey) mods.push('shift');
      if (e.metaKey) mods.push('meta');

      // If only modifiers pressed, don't record yet
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        setCurrentModifiers(mods);
        return;
      }

      // Accept the key combination
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Don't accept modifier-only combos
      if (mods.length === 0 && !e.key) return;

      setCurrentKey(key);
      setCurrentModifiers(mods);
      setRecording(false);

      onSave({ key, modifiers: mods });
    },
    [onCancel, onSave]
  );

  const displayShortcut = currentKey
    ? { key: currentKey, modifiers: currentModifiers }
    : shortcut;

  const formatted = formatShortcut(displayShortcut);

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setRecording(true)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono transition-colors ${
            recording
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
              : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
          }`}
        >
          <Keyboard className="w-3 h-3" />
          <span>{formatted}</span>
        </button>

        {recording && (
          <input
            type="text"
            autoFocus
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setRecording(false);
              setCurrentKey(null);
              setCurrentModifiers([]);
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => onSave({ key: '', modifiers: [] })}
        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        title={t('ui.removeShortcut')}
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {conflictLabel && (
        <span className="text-[10px] text-[var(--color-danger)]">
          {t('shortcuts.conflict', { action: conflictLabel })}
        </span>
      )}
    </div>
  );
};
