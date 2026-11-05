import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useI18n } from '../../i18n';
import { useAppSettingsStore } from '../../store/appSettingsStore';

/**
 * Confirma el cierre de la aplicacion cuando el usuario lo ha pedido en los
 * ajustes. La capa nativa bloquea el cierre y emite este evento.
 */
export const CloseGuard: React.FC = () => {
  const { t } = useI18n();
  const { settings } = useAppSettingsStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    try {
      listen('aetheria://close-requested', () => setOpen(true))
        .then((fn) => {
          unlisten = fn;
        })
        .catch((error) => console.error(error));
    } catch (error) {
      console.error(error);
    }

    return () => unlisten?.();
  }, []);

  if (!open || !settings.confirmBeforeClose) return null;

  const confirm = async () => {
    setOpen(false);
    try {
      await invoke('close_window');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('appSettings.confirmCloseTitle')}
        className="lib-ring w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-2xl"
      >
        <h2 className="lib-serif text-xl font-semibold">{t('appSettings.confirmCloseTitle')}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {t('appSettings.confirmCloseMessage')}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="lib-ring flex-1 rounded-full border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
          >
            {t('appSettings.confirmCloseCancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="lib-ring flex-1 rounded-full bg-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('appSettings.confirmCloseAccept')}
          </button>
        </div>
      </div>
    </div>
  );
};
