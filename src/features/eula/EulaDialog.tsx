import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';
import { Scale, X, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { useEulaStore } from '../../store/eulaStore';
import {
  EULA_LANGUAGES,
  EULA_TEXTS,
  EULA_VERSION,
  type EulaLanguage,
} from '../../content/eula';

/**
 * Dialogo de la licencia de uso.
 *
 * Tiene dos modos:
 * - **Obligatorio**: mientras no se acepta la licencia, el dialogo se muestra
 *   al arrancar la aplicacion y no se puede cerrar sin aceptar o rechazar.
 * - **Informativo**: desde los ajustes se puede volver a leer la licencia.
 */
export const EulaDialog: React.FC = () => {
  const { t } = useI18n();
  const isLoaded = useAppSettingsStore((state) => state.isLoaded);
  const eulaAccepted = useAppSettingsStore((state) => state.settings.eulaAccepted);
  const eulaAcceptedVersion = useAppSettingsStore((state) => state.settings.eulaAcceptedVersion);
  const acceptEula = useAppSettingsStore((state) => state.acceptEula);
  const isOpen = useEulaStore((state) => state.isOpen);
  const closeEula = useEulaStore((state) => state.close);

  const appLanguage = useAppSettingsStore((state) => state.settings.language);
  const [language, setLanguage] = useState<EulaLanguage>(appLanguage === 'en' ? 'en' : 'es');
  const [accepted, setAccepted] = useState(false);
  const wasVisible = useRef(false);

  // Mientras no se lean los ajustes no se sabe si la licencia esta aceptada:
  // el dialogo no debe aparecer ni siquiera un instante en ese caso.
  // Si se publica una version nueva del documento hay que aceptarla otra vez.
  const required = isLoaded && (!eulaAccepted || eulaAcceptedVersion !== EULA_VERSION);
  const visible = required || isOpen;

  // Cada vez que el dialogo se abre, el idioma vuelve al de la aplicacion y
  // se desmarca la casilla de aceptacion.
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setLanguage(appLanguage === 'en' ? 'en' : 'es');
      setAccepted(false);
    }
    wasVisible.current = visible;
  }, [visible, appLanguage]);

  const html = useMemo(
    () =>
      // `mangle` y `headerIds` estan obsoletos en marked 5 y avisan por consola.
      marked.parse(EULA_TEXTS[language], { mangle: false, headerIds: false }),
    [language]
  );

  const handleAccept = async () => {
    await acceptEula(EULA_VERSION);
    closeEula();
  };

  // Rechazar la licencia equivale a no usar la aplicacion: se cierra.
  const handleDecline = async () => {
    try {
      await invoke('close_window');
    } catch {
      window.close();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="lib-ring flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />
              <h2 className="lib-serif text-2xl font-semibold text-[var(--color-text-primary)]">
                {t('eula.title')}
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('eula.version')} {EULA_VERSION} · {t('eula.subtitle')}
            </p>
          </div>
          {/* En modo obligatorio no hay boton de cerrar: hay que aceptar o rechazar. */}
          {!required && (
            <button
              type="button"
              onClick={closeEula}
              className="lib-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Selector de idioma del documento */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-6 py-3">
          <span className="mr-1 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('eula.language')}
          </span>
          <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-1">
            {EULA_LANGUAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id)}
                className={`lib-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  language === item.id
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Texto de la licencia */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="changelog-body" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        {/* Pie: aceptar y rechazar */}
        {required ? (
          <div className="border-t border-[var(--color-border)] px-6 py-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span>{t('eula.acceptLabel')}</span>
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleDecline()}
                className="lib-ring rounded-lg px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              >
                {t('eula.decline')}
              </button>
              <button
                type="button"
                disabled={!accepted}
                onClick={() => void handleAccept()}
                className={`lib-ring flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  accepted
                    ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
                    : 'cursor-not-allowed bg-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
              >
                <Check className="h-4 w-4" />
                {t('eula.accept')}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">{t('eula.declineHint')}</p>
          </div>
        ) : (
          <div className="flex justify-end border-t border-[var(--color-border)] px-6 py-4">
            <button
              type="button"
              onClick={closeEula}
              className="lib-ring rounded-lg bg-[var(--color-bg-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
