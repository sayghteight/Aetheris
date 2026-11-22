import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, Plus, Eye, X, ArrowLeft, FileClock, RotateCcw, Trash2, GitCompare } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../../../i18n';
import { useRevisionStore, SceneRevision, SceneRevisionMeta } from '../../../store/revisionStore';
import { TiptapEditor } from '../../editor/TiptapEditor';
import { RevisionDiffView } from './RevisionDiffView';
import { htmlToPlainText } from './diff';

interface RevisionsControlProps {
  /** Escena a la que pertenecen las revisiones. */
  sceneId: string;
  /**
   * Fuerza el guardado del contenido pendiente en el editor. Se ejecuta antes
   * de crear una revision para que la copia sea exactamente lo que el
   * escritor tiene en pantalla.
   */
  flush: () => Promise<void>;
  /** Se llama tras restaurar una revision, para que el editor recargue el texto. */
  onRestored?: () => Promise<void> | void;
}

/**
 * Control de revisiones de una escena.
 *
 * Vive dentro del editor de Manuscritos: crea una revision inmutable del
 * contenido actual y permite gestionar el historial (consultar, restaurar y
 * eliminar revisiones).
 */
export const RevisionsControl: React.FC<RevisionsControlProps> = ({ sceneId, flush, onRestored }) => {
  const { t } = useI18n();
  const { revisions, isSaving, error, fetchRevisions, createRevision } = useRevisionStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [label, setLabel] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    fetchRevisions(sceneId);
  }, [sceneId, fetchRevisions]);

  const handleCreate = useCallback(async () => {
    setLocalError(null);
    try {
      // El contenido pendiente se guarda antes de copiarlo: la revision
      // refleja exactamente lo que hay en pantalla.
      await flush();
      await createRevision(sceneId, label);
      setLabel('');
      setShowCreate(false);
    } catch (err: any) {
      setLocalError(err?.message || t('manuscript.revisions.error'));
    }
  }, [flush, createRevision, sceneId, label, t]);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <History className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]" />
          <span className="text-xs text-[var(--color-text-secondary)]">{t('manuscript.revisions.title')}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
            {revisions.length}
          </span>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <FileClock className="h-3.5 w-3.5" />
          {t('manuscript.revisions.history')}
        </button>

        <button
          onClick={() => { setLocalError(null); setShowCreate(true); }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('manuscript.revisions.create')}
        </button>
      </div>

      {/* Crear revision */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <ModalHeader
            icon={<Plus className="w-4 h-4 text-[var(--color-brand)]" />}
            title={t('manuscript.revisions.createTitle')}
            onClose={() => setShowCreate(false)}
          />
          <div className="px-4 py-4 flex flex-col gap-2">
            <label className="text-xs text-[var(--color-text-secondary)]" htmlFor="revision-label">
              {t('manuscript.revisions.nameLabel')}
            </label>
            <input
              id="revision-label"
              type="text"
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowCreate(false);
              }}
              placeholder={t('manuscript.revisions.namePlaceholder')}
              className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-brand)]"
            />
            {(localError || error) && (
              <p className="text-xs text-[var(--color-danger)]">{localError || error}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
            >
              {isSaving ? t('manuscript.revisions.saving') : t('manuscript.revisions.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* Historial */}
      {showHistory && (
        <RevisionsHistoryDialog
          sceneId={sceneId}
          flush={flush}
          onRestored={onRestored}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
};

// ─── Historial ──────────────────────────────────────────────────────────────

const RevisionsHistoryDialog: React.FC<{
  sceneId: string;
  flush: () => Promise<void>;
  onRestored?: () => Promise<void> | void;
  onClose: () => void;
}> = ({ sceneId, flush, onRestored, onClose }) => {
  const { t, language } = useI18n();
  const { revisions, isLoading, fetchRevisions, createRevision, restoreRevision, deleteRevision } = useRevisionStore();

  const [viewing, setViewing] = useState<SceneRevision | null>(null);
  const [restoring, setRestoring] = useState<SceneRevisionMeta | null>(null);
  const [deleting, setDeleting] = useState<SceneRevisionMeta | null>(null);
  const [snapshotBefore, setSnapshotBefore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Vista del contenido de la revision: el texto tal cual, o las diferencias.
  const [viewMode, setViewMode] = useState<'content' | 'diff'>('content');
  // Con que se compara la revision: el texto actual o la revision anterior.
  const [diffBase, setDiffBase] = useState<'current' | 'previous'>('current');
  const [diffTexts, setDiffTexts] = useState<{ base: string; target: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  useEffect(() => {
    fetchRevisions(sceneId);
  }, [sceneId, fetchRevisions]);

  const formatDate = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(language === 'en' ? 'en-US' : 'es-ES');
  };

  // `flush` se guarda en una ref para que el efecto de las diferencias no se
  // repita cada vez que el padre crea una funcion nueva.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /**
   * Calcula las diferencias de la revision que se esta viendo.
   *
   * - Contra el texto actual: lo que ha cambiado desde la revision.
   * - Contra la revision anterior: lo que cambio en la revision.
   */
  useEffect(() => {
    if (viewMode !== 'diff' || !viewing) return;

    let cancelled = false;

    const load = async () => {
      setDiffLoading(true);
      setDiffError(null);
      setDiffTexts(null);
      try {
        const revisionText = htmlToPlainText(viewing.content);

        if (diffBase === 'current') {
          // Se guarda lo pendiente: la comparacion es contra lo que hay en pantalla.
          await flushRef.current();
          const currentHtml = await invoke<string | null>('get_scene_content', {
            nodeId: viewing.node_id,
          });
          if (cancelled) return;
          setDiffTexts({ base: revisionText, target: htmlToPlainText(currentHtml ?? '') });
          return;
        }

        const previous = revisions.find(
          (item) => item.revision_number === viewing.revision_number - 1
        );
        if (!previous) {
          if (!cancelled) setDiffError(t('manuscript.revisions.noPrevious'));
          return;
        }
        const previousRevision = await useRevisionStore.getState().getRevision(previous.id);
        if (cancelled) return;
        setDiffTexts({
          base: htmlToPlainText(previousRevision.content),
          target: revisionText,
        });
      } catch (err: any) {
        if (!cancelled) {
          setDiffError(err?.message || t('manuscript.revisions.diffError'));
        }
      } finally {
        if (!cancelled) setDiffLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [viewMode, diffBase, viewing, revisions, t]);

  const handleView = async (id: string) => {
    setActionError(null);
    try {
      const revision = await useRevisionStore.getState().getRevision(id);
      setViewing(revision);
    } catch (err: any) {
      setActionError(err?.message || t('manuscript.revisions.error'));
    }
  };

  /**
   * Restaura una revision: su contenido pasa a ser el texto vivo de la
   * escena, para poder seguir escribiendo desde ese enfoque.
   *
   * Si el escritor lo pide, antes se guarda el estado actual como revision,
   * de modo que el trabajo que se iba a sustituir no se pierde.
   */
  const handleRestore = async () => {
    if (!restoring) return;
    setBusy(true);
    setActionError(null);
    try {
      if (snapshotBefore) {
        await flush();
        await createRevision(sceneId, t('manuscript.revisions.snapshotLabel'));
      }
      await restoreRevision(restoring.id);
      await onRestored?.();
      setRestoring(null);
      setViewing(null);
    } catch (err: any) {
      setActionError(err?.message || t('manuscript.revisions.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteRevision(deleting.id);
      if (viewing?.id === deleting.id) setViewing(null);
      setDeleting(null);
    } catch (err: any) {
      setActionError(err?.message || t('manuscript.revisions.error'));
    } finally {
      setBusy(false);
    }
  };

  // Vista del contenido de una revision
  if (viewing) {
    return (
      <Modal onClose={onClose} wide>
        <ModalHeader
          icon={<Eye className="w-4 h-4 text-[var(--color-brand)]" />}
          title={t('manuscript.revisions.readOnly', { number: viewing.revision_number })}
          onClose={onClose}
        />
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          {viewing.label && (
            <span className="text-[var(--color-text-secondary)] font-medium truncate">{viewing.label}</span>
          )}
          <span>{formatDate(viewing.created_at)}</span>
          <span>{viewing.word_count} {t('manuscript.revisions.words')}</span>
        </div>

        {/* Pestañas: contenido o diferencias */}
        <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
          <button
            onClick={() => setViewMode('content')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'content'
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('manuscript.revisions.viewContent')}
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'diff'
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            {t('manuscript.revisions.viewDiff')}
          </button>
        </div>

        {/* Con que se compara la revision */}
        {viewMode === 'diff' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-4 py-2 text-xs">
            <span className="text-[var(--color-text-muted)]">{t('manuscript.revisions.compareWith')}</span>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5">
              <button
                onClick={() => setDiffBase('current')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  diffBase === 'current'
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {t('manuscript.revisions.compareCurrent')}
              </button>
              <button
                onClick={() => setDiffBase('previous')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  diffBase === 'previous'
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {t('manuscript.revisions.comparePrevious')}
              </button>
            </div>
            <span className="text-[var(--color-text-muted)]">
              {diffBase === 'current'
                ? t('manuscript.revisions.compareCurrentHint')
                : t('manuscript.revisions.comparePreviousHint')}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-hidden bg-[var(--color-bg-primary)] p-3">
          {viewMode === 'diff' ? (
            <div className="h-full overflow-y-auto">
              {diffLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-[var(--color-text-muted)]">
                  {t('common.loading')}
                </div>
              ) : diffError ? (
                <p className="text-xs text-[var(--color-danger)]">{diffError}</p>
              ) : diffTexts ? (
                <RevisionDiffView baseText={diffTexts.base} targetText={diffTexts.target} />
              ) : null}
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <TiptapEditor content={viewing.content} onChange={() => {}} editable={false} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => setViewing(null)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('manuscript.revisions.back')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setDeleting({
                  id: viewing.id,
                  node_id: viewing.node_id,
                  revision_number: viewing.revision_number,
                  label: viewing.label,
                  word_count: viewing.word_count,
                  created_at: viewing.created_at,
                  is_current: false,
                });
                setViewing(null);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('manuscript.revisions.delete')}
            </button>
            <button
              onClick={() => {
                setRestoring({
                  id: viewing.id,
                  node_id: viewing.node_id,
                  revision_number: viewing.revision_number,
                  label: viewing.label,
                  word_count: viewing.word_count,
                  created_at: viewing.created_at,
                  is_current: false,
                });
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('manuscript.revisions.restore')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Lista de revisiones
  return (
    <Modal onClose={onClose}>
      <ModalHeader
        icon={<History className="w-4 h-4 text-[var(--color-brand)]" />}
        title={t('manuscript.revisions.history')}
        onClose={onClose}
      />

      {actionError && (
        <p className="px-4 py-2 text-xs text-[var(--color-danger)] border-b border-[var(--color-border)]">{actionError}</p>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)] text-xs">
            {t('common.loading')}
          </div>
        ) : revisions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <History className="h-6 w-6 text-[var(--color-text-muted)] opacity-50" />
            <p className="text-sm text-[var(--color-text-secondary)]">{t('manuscript.revisions.empty')}</p>
            <p className="text-xs text-[var(--color-text-muted)] max-w-xs">{t('manuscript.revisions.emptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {revisions.map(revision => (
              <div
                key={revision.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="shrink-0 w-7 h-7 rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)] flex items-center justify-center text-xs font-bold">
                  {revision.revision_number}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">
                      {revision.label || t('manuscript.revisions.defaultLabel', { number: revision.revision_number })}
                    </p>
                    {revision.is_current && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        {t('manuscript.revisions.isCurrent')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {formatDate(revision.created_at)} · {revision.word_count} {t('manuscript.revisions.words')}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleView(revision.id)}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-brand)]/10 hover:text-[var(--color-brand)] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('manuscript.revisions.view')}
                  </button>
                  <button
                    onClick={() => { setActionError(null); setRestoring(revision); }}
                    title={t('manuscript.revisions.restore')}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-brand)]/10 hover:text-[var(--color-brand)] transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => { setActionError(null); setDeleting(revision); }}
                    title={t('manuscript.revisions.delete')}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end px-4 py-3 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold"
        >
          {t('common.close')}
        </button>
      </div>

      {/* Confirmacion de restauracion */}
      {restoring && (
        <Modal onClose={() => setRestoring(null)}>
          <ModalHeader
            icon={<RotateCcw className="w-4 h-4 text-[var(--color-brand)]" />}
            title={t('manuscript.revisions.restoreTitle', { number: restoring.revision_number })}
            onClose={() => setRestoring(null)}
          />
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {t('manuscript.revisions.restoreWarning')}
            </p>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={snapshotBefore}
                onChange={e => setSnapshotBefore(e.target.checked)}
                className="mt-0.5 accent-[var(--color-brand)]"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t('manuscript.revisions.snapshotBefore')}
              </span>
            </label>
            {actionError && <p className="text-xs text-[var(--color-danger)]">{actionError}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => setRestoring(null)}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleRestore}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
            >
              {t('manuscript.revisions.restore')}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirmacion de borrado */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <ModalHeader
            icon={<Trash2 className="w-4 h-4 text-[var(--color-danger)]" />}
            title={t('manuscript.revisions.deleteTitle', { number: deleting.revision_number })}
            onClose={() => setDeleting(null)}
          />
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {t('manuscript.revisions.deleteWarning')}
            </p>
            {actionError && <p className="text-xs text-[var(--color-danger)]">{actionError}</p>}
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => setDeleting(null)}
              className="text-xs px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-danger)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold"
            >
              {t('manuscript.revisions.delete')}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
};

// ─── Piezas de interfaz ─────────────────────────────────────────────────────

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; wide?: boolean }> = ({ children, onClose, wide }) => (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
    onClick={onClose}
  >
    <div
      className={`bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        wide ? 'w-[min(900px,95vw)] h-[min(85vh,900px)]' : 'w-[min(560px,95vw)] max-h-[85vh]'
      }`}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

const ModalHeader: React.FC<{ icon: React.ReactNode; title: string; onClose: () => void }> = ({ icon, title, onClose }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
    <div className="flex items-center gap-2 min-w-0">
      {icon}
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{title}</h3>
    </div>
    <button
      onClick={onClose}
      className="p-1 hover:bg-[var(--color-bg-hover)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

export default RevisionsControl;
