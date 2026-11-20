import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tag, GitBranch, ArrowUpRight } from 'lucide-react';
import { useI18n } from '../../i18n';
import { openUrl } from '@tauri-apps/plugin-opener';
import { marked } from 'marked';

import { VERSION } from '../../utils/version';
import { DOCUMENTED_SECTIONS, type ChangelogSection } from '../../utils/changelog';

// El historial completo son las versiones publicadas del repositorio (el
// proyecto se versiona con tags, no con releases de GitHub). El repositorio
// se renombro a "Aetheris": la URL antigua redirige, pero se usa la nueva.
const HISTORY_URL = 'https://github.com/sayghteight/Aetheris/tags';

export const ChangelogPanel: React.FC = () => {
  const { t } = useI18n();
  // Por defecto se muestra la version que lleva la aplicacion; si esa version
  // todavia no tiene changelog, se muestra la mas reciente que si lo tiene.
  const [selectedVersion, setSelectedVersion] = useState<string>(() => {
    if (DOCUMENTED_SECTIONS.some((item) => item.version === VERSION)) return VERSION;
    return DOCUMENTED_SECTIONS[0]?.version ?? VERSION;
  });

  const section: ChangelogSection | undefined = useMemo(
    () => DOCUMENTED_SECTIONS.find((item) => item.version === selectedVersion),
    [selectedVersion]
  );

  const html = useMemo(
    () =>
      section
        ? // `mangle` y `headerIds` estan obsoletos en marked 5 y avisan por
          // consola: el registro de cambios no necesita ninguna de las dos.
          marked.parse(section.body, { mangle: false, headerIds: false })
        : '',
    [section]
  );

  const openExternal = async (url: string): Promise<void> => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Un enlace del markdown no sale al navegador del sistema por si solo: en la
  // webview navega dentro de la aplicacion. Hay que interceptarlo y abrirlo
  // con el plugin de Tauri.
  const handleBodyClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || !/^https?:\/\//i.test(href)) return;

    event.preventDefault();
    void openExternal(href);
  };

  const openGitHub = async () => {
    await openExternal(HISTORY_URL);
  };

  // Al cambiar de version el contenido se sustituye entero: la posicion de
  // scroll se reinicia, para no aparecer a media lectura de otra version.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [selectedVersion]);

  return (
    // El area principal de la aplicacion no tiene scroll propio (es
    // `overflow-hidden`): cada panel gestiona el suyo. Aqui la cabecera se
    // queda fija y solo el contenido largo se desplaza.
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-3 px-6 pt-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <h1 className="truncate text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {t('changelog.title')}
              </h1>
              {section && (
                <span className="shrink-0 rounded-md bg-[var(--color-accent)]/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-accent)]">
                  v{section.version}
                </span>
              )}
              {section?.version === VERSION && (
                <span className="shrink-0 rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  {t('changelog.current')}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {section?.date || t('changelog.empty')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void openGitHub()}
            className="lib-ring flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>{t('changelog.fullHistory')}</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {/* Selector de version */}
        {DOCUMENTED_SECTIONS.length > 1 && (
          <div className="mx-auto max-w-3xl px-6 pb-4 pt-4">
            <div
              role="tablist"
              aria-label={t('changelog.title')}
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1"
            >
              {DOCUMENTED_SECTIONS.map((item) => {
                const active = item.version === selectedVersion;
                return (
                  <button
                    key={item.version}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedVersion(item.version)}
                    className={`lib-ring rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[var(--color-brand)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    v{item.version}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Contenido de la version */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-7">
          {section ? (
            <div
              className="changelog-body"
              onClick={handleBodyClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">{t('changelog.empty')}</p>
          )}
        </div>
      </div>
    </div>
  );
};
