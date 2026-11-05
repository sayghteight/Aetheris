import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useManuscriptStore } from '../../store/manuscriptStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useShortcutsStore, SHORTCUT_DEFINITIONS, ShortcutAction } from '../../store/shortcutsStore';
import { useI18n } from '../../i18n';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import { AppSettingsDialog } from '../settings/AppSettingsDialog';
import { BackupPanel } from './BackupPanel';
import {
  BookOpen,
  Settings2,
  RotateCcw,
  AlertTriangle,
  Check,
  Keyboard,
  SlidersHorizontal,
  Archive,
} from 'lucide-react';

export const ProjectSettings: React.FC = () => {
  const { t } = useI18n();
  const { currentProject: project } = useProjectStore();
  const { loadSettings } = useSettingsStore();
  const { fetchNodes } = useManuscriptStore();
  const { setActiveView } = useWorkspaceStore();
  const { loadShortcuts, setShortcut, resetToDefaults, getShortcut } = useShortcutsStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);
  const [conflictLabel, setConflictLabel] = useState<string | null>(null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);

  // Project info
  const [title, setTitle] = useState(project?.title ?? '');
  const [author, setAuthor] = useState(project?.author ?? '');
  const [description, setDescription] = useState(project?.description ?? '');

  useEffect(() => {
    loadSettings();
    loadShortcuts();
  }, [loadSettings, loadShortcuts]);

  useEffect(() => {
    if (project) {
      setTitle(project.title ?? '');
      setAuthor(project.author ?? '');
      setDescription(project.description ?? '');
    }
  }, [project]);

  const handleSaveProjectInfo = async () => {
    try {
      await invoke('update_project_metadata', {
        title,
        author,
        description,
        genre: null,
        synopsis: null,
      });
      setSaved('project');
      setTimeout(() => setSaved(null), 2000);
    } catch (error) {
      console.error('No se pudo guardar la información del proyecto:', error);
    }
  };

  const handleResetProject = async () => {
    setIsResetting(true);
    try {
      await invoke('reset_project');
      await fetchNodes();
      setActiveView('manuscript');
      setShowResetConfirm(false);
    } catch (error) {
      console.error('No se pudo resetear el proyecto:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const SavedMessage = () => (
    <span className="text-[var(--color-success)] text-sm flex items-center gap-2">
      <Check className="w-4 h-4" />
      {t('settings.saved')}
    </span>
  );

  const [activeTab, setActiveTab] = useState<'project' | 'backups' | 'shortcuts'>('project');

  const tabs = [
    { id: 'project' as const, label: t('setup.title') || 'Proyecto', icon: BookOpen },
    { id: 'backups' as const, label: t('backup.title'), icon: Archive },
    { id: 'shortcuts' as const, label: t('settings.keyboardShortcuts'), icon: Keyboard },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto pt-6 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-text-primary)] flex items-center gap-3">
          <Settings2 className="w-6 h-6 text-[var(--color-brand)]" />
          {t('settings.title')}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('settings.subtitle') || 'Gestiona la configuración de tu proyecto y editor.'}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Project Tab ─── */}
      {activeTab === 'project' && (
        <>
          <section className="min-w-[420px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-4 h-4 text-[var(--color-brand)]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t('setup.title')}</h3>
              {saved === 'project' && <SavedMessage />}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{t('setup.novelTitle')}</div>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('setup.novelTitlePlaceholder')} className="w-full bg-transparent text-[var(--color-text-primary)] font-semibold outline-none" />
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/60 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{t('setup.author')}</div>
                  <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('setup.authorPlaceholder')} className="w-full bg-transparent text-[var(--color-text-primary)] outline-none" />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/60 p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">{t('setup.synopsis')}</div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('setup.synopsisPlaceholder')} rows={4} className="w-full bg-transparent text-[var(--color-text-secondary)] outline-none resize-none" />
              </div>
            </div>
            <button onClick={handleSaveProjectInfo} className="mt-4 w-full md:w-auto rounded-lg bg-[var(--color-brand-bg)] border border-[var(--color-brand)]/30 px-4 py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition-colors">{t('common.save')}</button>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('appSettings.title')}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {t('appSettings.projectScopeHint')}
                </p>
              </div>
              <button
                onClick={() => setAppSettingsOpen(true)}
                className="lib-ring inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t('appSettings.open')}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-danger)]/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--color-danger)]">{t('settings.resetProject')}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('settings.resetWarning')}</p>
                {!showResetConfirm ? (
                  <button onClick={() => setShowResetConfirm(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 transition-colors">
                    <RotateCcw className="w-4 h-4" />{t('settings.resetButton')}
                  </button>
                ) : (
                  <div className="mt-4 flex items-center gap-3">
                    <button onClick={handleResetProject} disabled={isResetting} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-danger)]/80 disabled:opacity-50 transition-colors">
                      <RotateCcw className="w-4 h-4" />{isResetting ? t('settings.resetting') || 'Reseteando…' : t('common.confirm')}
                    </button>
                    <button onClick={() => setShowResetConfirm(false)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">{t('common.cancel')}</button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* ─── Backups Tab ─── */}
      {activeTab === 'backups' && (
        <BackupPanel />
      )}

      {/* ─── Shortcuts Tab ─── */}
      {activeTab === 'shortcuts' && (
        <>
        <section className="min-w-[420px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <Keyboard className="w-4 h-4 text-[var(--color-brand)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t('settings.keyboardShortcuts')}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHORTCUT_DEFINITIONS.map(({ action, label }) => {
              const shortcut = getShortcut(action);
              const isEditing = editingShortcut === action;

              return (
                <div key={action} className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)]/60 border border-[var(--color-border)] rounded-xl hover:border-[var(--color-text-muted)] transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--color-text-muted)]">{label.charAt(0)}</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <ShortcutRecorder
                        shortcut={shortcut}
                        onSave={(newShortcut) => {
                          if (newShortcut.key === '') { setEditingShortcut(null); setConflictLabel(null); return; }
                          const { conflict: conflictAction } = setShortcut(action, newShortcut);
                          if (conflictAction) { const def = SHORTCUT_DEFINITIONS.find(d => d.action === conflictAction); setConflictLabel(def?.label ?? conflictAction); }
                          else { setConflictLabel(null); setEditingShortcut(null); }
                        }}
                        onCancel={() => { setEditingShortcut(null); setConflictLabel(null); }}
                        conflictLabel={conflictLabel}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          {shortcut.modifiers.map((mod) => (
                            <span key={mod} className="px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] rounded">
                              {mod === 'ctrl' ? 'Ctrl' : mod === 'shift' ? 'Shift' : mod === 'alt' ? 'Alt' : 'Meta'}
                            </span>
                          ))}
                          <span className="px-1.5 py-0.5 text-xs font-bold bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded">{shortcut.key.toUpperCase()}</span>
                        </div>
                        <button onClick={() => { setEditingShortcut(action); setConflictLabel(null); }} className="ml-2 px-2 py-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-brand)] border border-transparent hover:border-[var(--color-brand)]/40 rounded transition-all opacity-0 group-hover:opacity-100">{t('common.edit')}</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {conflictLabel && (
            <p className="mt-3 text-xs text-[var(--color-accent)] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{t('settings.shortcutConflict')}: {conflictLabel}
            </p>
          )}

          <button onClick={resetToDefaults} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-hover)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-text-muted)] transition-colors">
            <RotateCcw className="w-4 h-4" />{t('settings.resetShortcuts')}
          </button>
        </section>
        </>
      )}

      <AppSettingsDialog open={appSettingsOpen} onClose={() => setAppSettingsOpen(false)} />
    </div>
  );
};
