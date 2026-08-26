import React, { useEffect, useState } from 'react';
import { useBackupStore, BackupSettings, BackupInfo } from '../../store/backupStore';
import { useProjectStore } from '../../store/projectStore';
import { useI18n } from '../../i18n';
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Upload,
  Clock,
  HardDrive,
} from 'lucide-react';

const MAX_BACKUP_OPTIONS = [
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: -1, label: 'Ilimitados' },
];

export const BackupPanel: React.FC = () => {
  const { t } = useI18n();
  const { activePath } = useProjectStore();
  const {
    settings,
    backups,
    oldBackups,
    isLoading,
    error,
    hasCheckedOldBackups,
    loadSettings,
    saveSettings,
    loadBackups,
    createBackup,
    deleteBackup,
    restoreBackup,
    verifyBackup,
    detectOldBackups,
    migrateOldBackups,
    pickFolder,
    openBackupFolder,
    clearError,
  } = useBackupStore();

  const [localSettings, setLocalSettings] = useState<BackupSettings>(settings);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<string | null>(null);
  const [restoreAsCopy, setRestoreAsCopy] = useState(false);
  const [migrationMode, setMigrationMode] = useState(false);
  const [selectedOldBackups, setSelectedOldBackups] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (activePath) {
      loadSettings();
      loadBackups(activePath);
      detectOldBackups(activePath);
    }
  }, [activePath, loadSettings, loadBackups, detectOldBackups]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleToggleEnabled = async () => {
    const newSettings = { ...localSettings, enabled: !localSettings.enabled };
    setLocalSettings(newSettings);
    await saveSettings(newSettings);
    setSaved('settings');
    setTimeout(() => setSaved(null), 2000);
  };

  const handleToggleIncremental = async () => {
    const newSettings = { ...localSettings, incremental: !localSettings.incremental };
    setLocalSettings(newSettings);
    await saveSettings(newSettings);
    setSaved('settings');
    setTimeout(() => setSaved(null), 2000);
  };

  const handleSelectFolder = async () => {
    const folder = await pickFolder();
    if (folder) {
      const newSettings = { ...localSettings, folder_path: folder };
      setLocalSettings(newSettings);
      await saveSettings(newSettings);
      setSaved('folder');
      setTimeout(() => setSaved(null), 2000);
    }
  };

  const handleMaxBackupsChange = async (maxBackups: number) => {
    const newSettings = { ...localSettings, max_backups: maxBackups };
    setLocalSettings(newSettings);
    await saveSettings(newSettings);
    setSaved('max');
    setTimeout(() => setSaved(null), 2000);
  };

  const handleCreateBackup = async () => {
    if (!activePath) return;
    try {
      await createBackup(activePath);
      setSaved('created');
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBackup = async (path: string) => {
    await deleteBackup(path);
    if (activePath) {
      await loadBackups(activePath);
    }
  };

  const handleRestoreBackup = async (backup: BackupInfo) => {
    if (!activePath) return;
    try {
      await restoreBackup(activePath, backup.path, restoreAsCopy);
      setShowRestoreConfirm(null);
      setSaved('restored');
      setTimeout(() => setSaved(null), 2000);
      // Reload project
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyBackup = async (path: string) => {
    const isValid = await verifyBackup(path);
    setVerifyResults(prev => new Map(prev).set(path, isValid));
  };

  const handleVerifyAll = async () => {
    for (const backup of backups) {
      await handleVerifyBackup(backup.path);
    }
  };

  const handleMigrateSelected = async () => {
    if (!activePath) return;
    const paths = Array.from(selectedOldBackups);
    if (paths.length === 0) return;

    try {
      await migrateOldBackups(activePath, paths);
      setMigrationMode(false);
      setSelectedOldBackups(new Set());
      setSaved('migrated');
      setTimeout(() => setSaved(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleOldBackupSelection = (path: string) => {
    setSelectedOldBackups(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getBackupFolderDisplay = () => {
    if (localSettings.folder_path) {
      return localSettings.folder_path;
    }
    return 'backups/ (por defecto)';
  };

  const isDefaultFolder = !localSettings.folder_path;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-[var(--color-brand)]" />
            {t('backup.title') || 'Backups'}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t('backup.subtitle') || 'Gestiona los backups de tu proyecto'}
          </p>
        </div>
        {saved && (
          <span className="text-[var(--color-success)] text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            {saved === 'created' && (t('backup.created') || 'Backup creado')}
            {saved === 'restored' && (t('backup.restored') || 'Backup restaurado')}
            {saved === 'migrated' && (t('backup.migrated') || 'Backups migrados')}
            {saved === 'settings' && (t('settings.saved') || 'Guardado')}
            {saved === 'folder' && (t('backup.folderSaved') || 'Carpeta guardada')}
            {saved === 'max' && (t('backup.maxSaved') || 'Límite guardado')}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30">
          <AlertTriangle className="w-5 h-5 text-[var(--color-danger)] shrink-0" />
          <span className="text-sm text-[var(--color-danger)]">{error}</span>
          <button onClick={clearError} className="ml-auto p-1 hover:bg-[var(--color-danger)]/20 rounded">
            <X className="w-4 h-4 text-[var(--color-danger)]" />
          </button>
        </div>
      )}

      {/* Settings Section */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">
          {t('backup.settings') || 'Configuración'}
        </h3>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('backup.enable') || 'Backups automáticos'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('backup.enableDesc') || 'Crear backups automáticamente al guardar'}
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              className={`w-12 h-7 rounded-full transition-all relative ${
                localSettings.enabled ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  localSettings.enabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Incremental Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('backup.incremental') || 'Copias incrementales'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {t('backup.incrementalDesc') || 'Limitar backups a uno cada 5 minutos'}
              </div>
            </div>
            <button
              onClick={handleToggleIncremental}
              className={`w-12 h-7 rounded-full transition-all relative ${
                localSettings.incremental ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg-tertiary)]'
              }`}
              disabled={!localSettings.enabled}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  localSettings.incremental ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Folder Selection */}
          <div className="p-4 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('backup.folder') || 'Carpeta de backups'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
                  {getBackupFolderDisplay()}
                </div>
                {isDefaultFolder && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    ({t('backup.defaultFolder') || 'Se creará automáticamente'})
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectFolder}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-brand-bg)] border border-[var(--color-brand)]/30 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition-colors"
                >
                  <Folder className="w-4 h-4" />
                  {t('backup.selectFolder') || 'Elegir'}
                </button>
                <button
                  onClick={() => activePath && openBackupFolder(activePath)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                  title={t('backup.openFolder') || 'Abrir carpeta'}
                >
                  <FolderOpen className="w-5 h-5 text-[var(--color-text-muted)]" />
                </button>
              </div>
            </div>
          </div>

          {/* Max Backups */}
          <div className="p-4 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('backup.maxBackups') || 'Máximo de backups'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {t('backup.maxBackupsDesc') || 'Los más antiguos se eliminarán automáticamente'}
                </div>
              </div>
              <select
                value={localSettings.max_backups}
                onChange={(e) => handleMaxBackupsChange(Number(e.target.value))}
                className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] outline-none"
              >
                {MAX_BACKUP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreateBackup}
          disabled={isLoading || !localSettings.enabled}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand-bg)] border border-[var(--color-brand)]/30 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('backup.createManual') || 'Crear backup ahora'}
        </button>
        <button
          onClick={handleVerifyAll}
          disabled={isLoading || backups.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('backup.verifyAll') || 'Verificar todos'}
        </button>
      </div>

      {/* Backup List */}
      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            {t('backup.list') || 'Backups'} ({backups.length})
          </h3>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('backup.noBackups') || 'No hay backups todavía'}</p>
            <p className="text-xs mt-1">
              {t('backup.noBackupsDesc') || 'Los backups se guardarán aquí automáticamente'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div
                key={backup.path}
                className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl hover:border-[var(--color-text-muted)] transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {backup.name}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(backup.created_at)}
                    </span>
                    <span>{formatSize(backup.size_bytes)}</span>
                    {verifyResults.has(backup.path) && (
                      <span className={verifyResults.get(backup.path) ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
                        {verifyResults.get(backup.path) ? (t('backup.valid') || '✓ Válido') : (t('backup.invalid') || '✗ Inválido')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleVerifyBackup(backup.path)}
                    className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                    title={t('backup.verify') || 'Verificar'}
                  >
                    <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </button>
                  <button
                    onClick={() => setShowRestoreConfirm(backup.path)}
                    className="p-2 rounded-lg hover:bg-[var(--color-brand)]/20 transition-colors"
                    title={t('backup.restore') || 'Restaurar'}
                  >
                    <RotateCcw className="w-4 h-4 text-[var(--color-brand)]" />
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(backup.path)}
                    className="p-2 rounded-lg hover:bg-[var(--color-danger)]/20 transition-colors"
                    title={t('backup.delete') || 'Eliminar'}
                  >
                    <Trash2 className="w-4 h-4 text-[var(--color-danger)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Old Backups Migration */}
      {hasCheckedOldBackups && oldBackups.length > 0 && !migrationMode && (
        <section className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--color-accent)]" />
              <div>
                <div className="text-sm font-semibold text-[var(--color-accent)]">
                  {t('backup.oldBackupsFound') || 'Backups antiguos detectados'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {t('backup.oldBackupsFoundDesc') || 'Se encontraron backups del sistema anterior que pueden migrarse'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setMigrationMode(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white hover:bg-[var(--color-accent)]/80 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {t('backup.migrate') || 'Migrar'} ({oldBackups.length})
            </button>
          </div>
        </section>
      )}

      {/* Migration Mode */}
      {migrationMode && oldBackups.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-accent)]">
              {t('backup.migrateOld') || 'Migrar backups antiguos'}
            </h3>
            <button
              onClick={() => {
                setMigrationMode(false);
                setSelectedOldBackups(new Set());
              }}
              className="p-1 rounded hover:bg-[var(--color-accent)]/20"
            >
              <X className="w-4 h-4 text-[var(--color-accent)]" />
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            {t('backup.migrateDesc') || 'Selecciona los backups que quieres migrar a la nueva carpeta'}
          </p>

          <div className="space-y-2 mb-4">
            {oldBackups.map((backup) => (
              <label
                key={backup.path}
                className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedOldBackups.has(backup.path)}
                  onChange={() => toggleOldBackupSelection(backup.path)}
                  className="w-4 h-4 rounded border-[var(--color-border)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{backup.name}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleMigrateSelected}
              disabled={selectedOldBackups.size === 0 || isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white hover:bg-[var(--color-accent)]/80 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {t('backup.migrateSelected') || 'Migrar seleccionados'} ({selectedOldBackups.size})
            </button>
            <button
              onClick={() => {
                setMigrationMode(false);
                setSelectedOldBackups(new Set());
              }}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </section>
      )}

      {/* Restore Confirmation Dialog */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              {t('backup.restoreConfirmTitle') || 'Restaurar backup'}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t('backup.restoreConfirmDesc') || '¿Estás seguro de que quieres restaurar este backup?'}
            </p>

            <label className="flex items-center gap-3 p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreAsCopy}
                onChange={(e) => setRestoreAsCopy(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)]"
              />
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('backup.restoreAsCopy') || 'Restaurar como copia'}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {t('backup.restoreAsCopyDesc') || 'Mantener el proyecto actual y crear una copia restaurada'}
                </div>
              </div>
            </label>

            {!restoreAsCopy && (
              <div className="p-3 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30 rounded-xl mb-4">
                <div className="flex items-center gap-2 text-xs text-[var(--color-warning)]">
                  <AlertTriangle className="w-4 h-4" />
                  {t('backup.restoreWarning') || 'Se creará un backup del estado actual antes de restaurar'}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const backup = backups.find(b => b.path === showRestoreConfirm);
                  if (backup) handleRestoreBackup(backup);
                }}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-brand)] text-sm font-semibold text-white hover:bg-[var(--color-brand)]/80 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t('backup.confirmRestore') || 'Restaurar'}
              </button>
              <button
                onClick={() => setShowRestoreConfirm(null)}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
