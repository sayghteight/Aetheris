import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';
import { RESTORE_REOPEN_KEY, useProjectStore } from '../../store/projectStore';
import { Archive, Camera, FolderOpen, RotateCcw, AlertTriangle, Check } from 'lucide-react';

/** Un punto de restauracion creado a mano. */
interface SnapshotInfo {
  id: string;
  label: string;
  createdAt: string;
  size: number;
  path: string;
}

/** Estado del sistema de copias de seguridad del proyecto. */
interface BackupStatus {
  backupDir: string;
  mainBackupPath: string;
  mainBackupExists: boolean;
  lastBackupAt: string | null;
  snapshotCount: number;
}

/** Tamano legible a partir de los bytes del archivo. */
const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Fecha legible en el formato local. */
const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

/**
 * Panel de copias de seguridad del proyecto.
 *
 * Muestra la copia automatica (un unico archivo que se mantiene al dia) y la
 * lista de snapshots, que solo crea el usuario.
 */
export const BackupPanel: React.FC = () => {
  const { t } = useI18n();
  const activePath = useProjectStore((state) => state.activePath);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SnapshotInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, info] = await Promise.all([
        invoke<SnapshotInfo[]>('list_snapshots'),
        invoke<BackupStatus>('get_backup_status'),
      ]);
      setSnapshots(list);
      setStatus(info);
    } catch (e) {
      console.error(e);
      setError(t('backup.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateSnapshot = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await invoke('create_snapshot');
      await load();
      setNotice(t('backup.snapshotCreated'));
    } catch (e) {
      console.error(e);
      setError(t('backup.error'));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshot: SnapshotInfo) => {
    setRestoringId(snapshot.id);
    setError(null);
    setNotice(null);
    try {
      await invoke('restore_snapshot', { snapshotId: snapshot.id });
      // El proyecto se ha sustituido por completo: hay que recargar todo el
      // estado en memoria (nodos, universo, linha de tiempo, pestanas...).
      if (activePath) {
        sessionStorage.setItem(RESTORE_REOPEN_KEY, activePath);
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
      setError(t('backup.error'));
      setRestoringId(null);
      setPendingRestore(null);
    }
  };

  const handleOpenFolder = async () => {
    if (!status) return;
    try {
      await revealItemInDir(status.backupDir);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Copia automatica */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Archive className="h-4 w-4 text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t('backup.autoTitle')}
              </h3>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">{t('backup.autoDesc')}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-muted)]">{t('backup.lastBackup')}:</span>{' '}
              {status?.lastBackupAt ? (
                <strong>{formatDate(status.lastBackupAt)}</strong>
              ) : (
                <span className="text-[var(--color-text-muted)]">{t('backup.never')}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!status}
            className="lib-ring inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t('backup.openFolder')}
          </button>
        </div>
      </section>

      {/* Snapshots */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t('backup.snapshots')}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('backup.createSnapshotDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCreateSnapshot}
            disabled={creating}
            className="lib-ring inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-brand)]/40 bg-[var(--color-brand-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/20 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {t('backup.createSnapshot')}
          </button>
        </div>

        {notice && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-success)]">
            <Check className="h-4 w-4" />
            {notice}
          </p>
        )}
        {error && (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--color-danger)]">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">…</p>
        ) : snapshots.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t('backup.noSnapshots')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('backup.noSnapshotsDesc')}
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {snapshot.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {formatDate(snapshot.createdAt)} · {t('backup.size')}: {formatSize(snapshot.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingRestore(snapshot)}
                  disabled={restoringId !== null}
                  className="lib-ring inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {restoringId === snapshot.id ? '…' : t('backup.restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Confirmacion de restauracion */}
      {pendingRestore && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="lib-ring w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t('backup.restoreConfirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {t('backup.restoreConfirmDesc', { snapshot: pendingRestore.label })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="lib-ring rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
              >
                {t('backup.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleRestore(pendingRestore)}
                className="lib-ring rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('backup.confirmRestore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
