import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useManuscriptStore } from '../../store/manuscriptStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useShortcutsStore, SHORTCUT_DEFINITIONS, ShortcutAction } from '../../store/shortcutsStore';
import { useI18n } from '../../i18n';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import {
  BookOpen,
  HardDrive,
  Settings2,
  RotateCcw,
  AlertTriangle,
  Type,
  Minus,
  Plus,
  Check,
  Keyboard,
  Moon,
  Sunset,
  Sparkles,
} from 'lucide-react';

// Available languages for spell checking
const SPELL_CHECK_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ca', name: 'Català', flag: '🇦🇩' },
  { code: 'gl', name: 'Galego', flag: '🇪🇸' },
  { code: 'eu', name: 'Euskara', flag: '🇪🇸' },
];

export const ProjectSettings: React.FC = () => {
  const { t } = useI18n();
  const { currentProject: project } = useProjectStore();
  const { settings, loadSettings, saveSettings } = useSettingsStore();
  const { fetchNodes } = useManuscriptStore();
  const { setActiveView } = useWorkspaceStore();
  const { loadShortcuts, setShortcut, resetToDefaults, getShortcut } = useShortcutsStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutAction | null>(null);
  const [conflictLabel, setConflictLabel] = useState<string | null>(null);

  // Project info
  const [title, setTitle] = useState(project?.title ?? '');
  const [author, setAuthor] = useState(project?.author ?? '');
  const [description, setDescription] = useState(project?.description ?? '');

  // Editor settings (local state)
  const [editorSettings, setEditorSettings] = useState({
    fontSize: settings.fontSize || 16,
    lineHeight: settings.lineHeight || 1.6,
    fontFamily: settings.fontFamily || 'default',
    textAlign: settings.textAlign || 'left',
    spellCheck: settings.spellCheck !== false,
    autoCorrect: settings.autoCorrect !== false,
    showWordCount: settings.showWordCount !== false,
  });

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

  useEffect(() => {
    setEditorSettings({
      fontSize: settings.fontSize || 16,
      lineHeight: settings.lineHeight || 1.6,
      fontFamily: settings.fontFamily || 'default',
      textAlign: settings.textAlign || 'left',
      spellCheck: settings.spellCheck !== false,
      autoCorrect: settings.autoCorrect !== false,
      showWordCount: settings.showWordCount !== false,
    });
  }, [settings]);

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

  const handleSaveSettings = async () => {
    await saveSettings({ ...settings, ...editorSettings });
    setSaved('settings');
    setTimeout(() => setSaved(null), 2000);
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

  const updateEditorSetting = (key: string, value: any) => {
    setEditorSettings(prev => ({ ...prev, [key]: value }));
  };

  const SavedMessage = () => (
    <span className="text-[var(--color-success)] text-sm flex items-center gap-2">
      <Check className="w-4 h-4" />
      {t('settings.saved')}
    </span>
  );

  const [activeTab, setActiveTab] = useState<'project' | 'editor' | 'shortcuts'>('project');

  const tabs = [
    { id: 'project' as const, label: t('setup.title') || 'Proyecto', icon: BookOpen },
    { id: 'editor' as const, label: t('editorSettings.title'), icon: Type },
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
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t('settings.autoSave')}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <button onClick={() => saveSettings({ ...settings, auto_save_enabled: !settings.auto_save_enabled })} className={`w-12 h-7 rounded-full transition-all relative ${settings.auto_save_enabled ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg-tertiary)]'}`}>
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.auto_save_enabled ? 'left-6' : 'left-1'}`} />
                </button>
                <span className="text-sm text-[var(--color-text-secondary)]">{t('settings.autoSaveEnabled')}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-[var(--color-text-muted)]">{t('settings.autoSaveInterval')}:</label>
                <select value={settings.auto_save_interval_minutes} onChange={(e) => saveSettings({ ...settings, auto_save_interval_minutes: Number(e.target.value) })} className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-secondary)] outline-none">
                  <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option>
                </select>
              </div>
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

      {/* ─── Editor Tab ─── */}
      {activeTab === 'editor' && (
        <>
          <section className="min-w-[420px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-[var(--color-accent)]" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t('editorSettings.title')}</h3>
              </div>
              {saved === 'settings' && <SavedMessage />}
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl p-4">
                <label className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{t('editorSettings.fontSize')}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateEditorSetting('fontSize', Math.max(12, editorSettings.fontSize - 1))} className="w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                  <div className="flex-1 text-center"><span className="text-xl font-bold text-[var(--color-text-primary)]">{editorSettings.fontSize}</span><span className="text-[var(--color-text-muted)] text-sm ml-1">px</span></div>
                  <button onClick={() => updateEditorSetting('fontSize', Math.min(24, editorSettings.fontSize + 1))} className="w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl p-4">
                <label className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{t('editorSettings.lineHeight')}</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateEditorSetting('lineHeight', Math.max(1.0, editorSettings.lineHeight - 0.1))} className="w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                  <div className="flex-1 text-center"><span className="text-xl font-bold text-[var(--color-text-primary)]">{editorSettings.lineHeight.toFixed(1)}</span></div>
                  <button onClick={() => updateEditorSetting('lineHeight', Math.min(2.5, editorSettings.lineHeight + 0.1))} className="w-8 h-8 rounded-lg bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">{t('settings.theme') || 'Tema'}</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    value: 'midnight',
                    label: 'Midnight',
                    desc: 'Azul profundo',
                    icon: Moon,
                    bg: 'bg-gradient-to-br from-[#13162a] to-[#252d55]',
                    accent: 'text-[#f0c040]',
                    border: 'border-[#333d66]'
                  },
                  {
                    value: 'aurora',
                    label: 'Aurora',
                    desc: 'Tonos cálidos',
                    icon: Sunset,
                    bg: 'bg-gradient-to-br from-[#1a1510] to-[#352d20]',
                    accent: 'text-[#f0b040]',
                    border: 'border-[#4a3d2e]'
                  },
                  {
                    value: 'noir',
                    label: 'Noir',
                    desc: 'Cyan neón',
                    icon: Sparkles,
                    bg: 'bg-gradient-to-br from-[#080a0d] to-[#181c24]',
                    accent: 'text-[#50e8e0]',
                    border: 'border-[#28303d]'
                  },
                ].map((theme) => {
                  const Icon = theme.icon;
                  const isActive = settings.theme === theme.value;
                  return (
                    <button
                      key={theme.value}
                      onClick={() => saveSettings({ ...settings, theme: theme.value as any })}
                      className={`p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isActive
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand-bg)]'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-xl ${theme.bg} border ${theme.border} flex items-center justify-center shrink-0 shadow-lg`}>
                        <Icon className={`w-6 h-6 ${isActive ? theme.accent : 'text-[var(--color-text-muted)]'}`} />
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-bold ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]'}`}>{theme.label}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{theme.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{t('settings.language')}</label>
                <select value={settings.language} onChange={(e) => saveSettings({ ...settings, language: e.target.value })} className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none">
                  <option value="es">{t('settings.languageEs')}</option>
                  <option value="en">{t('settings.languageEn')}</option>
                </select>
              </div>              
              <ToggleOption label={t('editorSettings.showWordCount')} enabled={editorSettings.showWordCount} onChange={(v) => updateEditorSetting('showWordCount', v)} />
            </div>

            {editorSettings.spellCheck && (
              <div className="mt-4 p-4 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
                <label className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">{t('editorSettings.spellCheckLanguages')}</label>
                <div className="flex flex-wrap gap-2">
                  {SPELL_CHECK_LANGUAGES.map((lang) => {
                    const isSelected = (settings.spell_check_languages || []).includes(lang.code);
                    return (
                      <button key={lang.code} type="button" onClick={() => { const current = settings.spell_check_languages || []; const next = isSelected ? current.filter((c: string) => c !== lang.code) : [...current, lang.code]; saveSettings({ ...settings, spell_check_languages: next }); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected ? 'bg-emerald-600/30 border border-emerald-500 text-emerald-300' : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'}`}>
                        {lang.flag} {lang.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleSaveSettings} className="mt-6 w-full md:w-auto rounded-lg bg-[var(--color-brand-bg)] border border-[var(--color-brand)]/30 px-4 py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition-colors">{t('common.save')}</button>
          </section>
        </>
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
    </div>
  );
};

interface ToggleOptionProps {
  label: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}

const ToggleOption: React.FC<ToggleOptionProps> = ({ label, enabled, onChange }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)]/40 border border-[var(--color-border)] rounded-xl">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-11 h-6 rounded-full transition-all relative ${
          enabled ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-bg-tertiary)]'
        }`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
          enabled ? 'left-5' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
};
