import React, { useMemo, useState } from 'react';
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

  return (
    <div className="max-w-2xl w-full mx-auto pt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-xs uppercase tracking-widest text-[var(--color-accent)] font-medium">
              v{section?.version ?? VERSION}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-text-primary)]">
            {t('changelog.title')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {section?.date || t('changelog.empty')}
          </p>
        </div>
        <button
          onClick={() => void openGitHub()}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors mt-1"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>{t('changelog.fullHistory')}</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Selector de version */}
      {DOCUMENTED_SECTIONS.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {DOCUMENTED_SECTIONS.map((item) => {
            const active = item.version === selectedVersion;
            return (
              <button
                key={item.version}
                type="button"
                onClick={() => setSelectedVersion(item.version)}
                className={`lib-ring rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                v{item.version}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido de la version */}
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
  );
};
