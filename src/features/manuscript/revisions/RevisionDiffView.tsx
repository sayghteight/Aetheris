import React, { useMemo } from 'react';
import { useI18n } from '../../../i18n';
import { buildRevisionDiff } from './diff';

interface RevisionDiffViewProps {
  /** Texto de partida (el mas antiguo). */
  baseText: string;
  /** Texto de llegada (el mas reciente). */
  targetText: string;
}

/**
 * Vista de las diferencias entre dos versiones del texto de una escena.
 *
 * Lo que se elimino va en rojo y tachado, lo que se cambio o se anadio va en
 * azul, al estilo de un `git diff`.
 */
export const RevisionDiffView: React.FC<RevisionDiffViewProps> = ({ baseText, targetText }) => {
  const { t } = useI18n();

  const diff = useMemo(() => buildRevisionDiff(baseText, targetText), [baseText, targetText]);
  const hasChanges = diff.addedWords > 0 || diff.removedWords > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="revision-diff-stat revision-diff-stat-added">
          +{diff.addedWords} {t('manuscript.revisions.added')}
        </span>
        <span className="revision-diff-stat revision-diff-stat-removed">
          −{diff.removedWords} {t('manuscript.revisions.removed')}
        </span>
        {!hasChanges && (
          <span className="text-[var(--color-text-muted)]">{t('manuscript.revisions.noChanges')}</span>
        )}
      </div>

      {/* Texto con las diferencias marcadas */}
      <div className="revision-diff-text">
        {diff.segments.map((segment, index) => (
          <span
            key={index}
            className={
              segment.type === 'added'
                ? 'revision-diff-added'
                : segment.type === 'removed'
                  ? 'revision-diff-removed'
                  : undefined
            }
          >
            {segment.value}
          </span>
        ))}
      </div>
    </div>
  );
};
