import React, { useEffect, useState } from 'react';
import { getCurrentWindow, primaryMonitor } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { useI18n } from '../../i18n';
import { AppTheme, useAppSettingsStore } from '../../store/appSettingsStore';
import { X, Maximize2, Minimize2, Monitor, Moon, Sparkles, Zap } from 'lucide-react';

/** Resoluciones ofrecidas además del tamaño del monitor. */
const RESOLUTION_PRESETS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1600, height: 1000 },
  { width: 1920, height: 1080 },
];

/** Límites de la ventana: coinciden con minWidth/minHeight de tauri.conf.json. */
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

const Toggle: React.FC<{
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, enabled, onChange }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div className="min-w-0">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {description}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 lib-ring ${
        enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

interface AppSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AppSettingsDialog: React.FC<AppSettingsDialogProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { settings, updateSettings } = useAppSettingsStore();

  const [monitorSize, setMonitorSize] = useState<{ width: number; height: number } | null>(null);
  const [customWidth, setCustomWidth] = useState(String(settings.windowWidth));
  const [customHeight, setCustomHeight] = useState(String(settings.windowHeight));

  // Tamaño del monitor principal.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    primaryMonitor()
      .then((monitor) => {
        if (cancelled || !monitor) return;

        setMonitorSize({
          width: Math.round(monitor.size.width / monitor.scaleFactor),
          height: Math.round(monitor.size.height / monitor.scaleFactor),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Los campos de resolución reflejan siempre el tamaño guardado.
  useEffect(() => {
    setCustomWidth(String(settings.windowWidth));
    setCustomHeight(String(settings.windowHeight));
  }, [settings.windowWidth, settings.windowHeight]);

  // Escape cierra el diálogo.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const applyResolution = async (width: number, height: number) => {
    const w = Math.max(MIN_WIDTH, Math.min(Math.round(width), 4000));
    const h = Math.max(MIN_HEIGHT, Math.min(Math.round(height), 3000));

    try {
      await getCurrentWindow().setSize(new LogicalSize(w, h));

      await updateSettings({
        windowWidth: w,
        windowHeight: h,
        windowMaximized: false,
        windowFullscreen: false,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleFullscreen = async () => {
    const next = !settings.windowFullscreen;

    try {
      await getCurrentWindow().setFullscreen(next);
      await updateSettings({ windowFullscreen: next });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleMaximize = async () => {
    try {
      const appWindow = getCurrentWindow();

      await appWindow.toggleMaximize();

      await updateSettings({
        windowMaximized: await appWindow.isMaximized(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const centerWindow = async () => {
    try {
      await getCurrentWindow().center();
    } catch (error) {
      console.error(error);
    }
  };

  const themes: {
    value: AppTheme;
    label: string;
    desc: string;
    icon: React.ElementType;
    bg: string;
    accent: string;
    border: string;
  }[] = [
    {
      value: 'midnight',
      label: 'Midnight',
      desc: t('settingsProject.deepBlue'),
      icon: Moon,
      bg: 'bg-gradient-to-br from-[#1a1f3d] to-[#0d1024]',
      accent: 'text-[#f0c040]',
      border: 'border-[#2d3560]',
    },
    {
      value: 'aurora',
      label: 'Aurora',
      desc: t('settingsProject.warmAmber'),
      icon: Sparkles,
      bg: 'bg-gradient-to-br from-[#3a2d1a] to-[#1a1510]',
      accent: 'text-[#f0b040]',
      border: 'border-[#5c452a]',
    },
    {
      value: 'noir',
      label: 'Noir',
      desc: 'Cyan neón',
      icon: Zap,
      bg: 'bg-gradient-to-br from-[#080a0d] to-[#181c24]',
      accent: 'text-[#50e8e0]',
      border: 'border-[#28303d]',
    },
  ];

  const currentResolution = `${settings.windowWidth} × ${settings.windowHeight}`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lib-ring flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl">

        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-6 py-5">
          <div>
            <h2 className="lib-serif text-2xl font-semibold">{t('appSettings.title')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('appSettings.subtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="lib-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto px-6 py-5">

          {/* Ventana */}
          <section className="mb-8">
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('appSettings.window')}
            </h3>

            <Toggle
              label={t('appSettings.fullscreen')}
              description={t('appSettings.fullscreenDesc')}
              enabled={settings.windowFullscreen}
              onChange={toggleFullscreen}
            />

            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.resolution')}
                </label>

                <span className="rounded-md bg-[var(--color-bg-secondary)] px-2 py-1 text-xs tabular-nums text-[var(--color-text-muted)]">
                  {currentResolution}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={`${settings.windowWidth}x${settings.windowHeight}`}
                  onChange={(event) => {
                    const [w, h] = event.target.value.split('x').map(Number);
                    if (w && h) applyResolution(w, h);
                  }}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  {RESOLUTION_PRESETS.map((preset) => (
                    <option
                      key={`${preset.width}x${preset.height}`}
                      value={`${preset.width}x${preset.height}`}
                    >
                      {preset.width} × {preset.height}
                    </option>
                  ))}

                  {monitorSize && (
                    <option value={`${monitorSize.width}x${monitorSize.height}`}>
                      {t('appSettings.monitorSize')} ({monitorSize.width} × {monitorSize.height})
                    </option>
                  )}
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_WIDTH}
                    max={4000}
                    value={customWidth}
                    onChange={(event) => setCustomWidth(event.target.value)}
                    onBlur={() => applyResolution(Number(customWidth), Number(customHeight))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                    aria-label={t('appSettings.customWidth')}
                  />

                  <span className="text-[var(--color-text-muted)]">×</span>

                  <input
                    type="number"
                    min={MIN_HEIGHT}
                    max={3000}
                    value={customHeight}
                    onChange={(event) => setCustomHeight(event.target.value)}
                    onBlur={() => applyResolution(Number(customWidth), Number(customHeight))}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                    aria-label={t('appSettings.customHeight')}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleMaximize}
                  className="lib-ring flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
                >
                  {settings.windowMaximized ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}

                  {settings.windowMaximized
                    ? t('appSettings.restore')
                    : t('appSettings.maximize')}
                </button>

                <button
                  type="button"
                  onClick={centerWindow}
                  className="lib-ring flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  {t('appSettings.center')}
                </button>
              </div>
            </div>

            <div className="mt-2">
              <Toggle
                label={t('appSettings.restoreWindow')}
                description={t('appSettings.restoreWindowDesc')}
                enabled={settings.restoreWindowOnStart}
                onChange={(value) => updateSettings({ restoreWindowOnStart: value })}
              />
            </div>
          </section>

          {/* Apariencia */}
          <section className="mb-8">
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('appSettings.appearance')}
            </h3>

            <div className="grid gap-3 sm:grid-cols-3">
              {themes.map((theme) => {
                const Icon = theme.icon;
                const isActive = settings.theme === theme.value;

                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => updateSettings({ theme: theme.value })}
                    className={`lib-ring flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      isActive
                        ? 'border-[var(--color-brand)] bg-[var(--color-brand-bg)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border shadow-lg ${theme.bg} ${theme.border}`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? theme.accent : 'text-[var(--color-text-muted)]'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold ${
                          isActive
                            ? 'text-[var(--color-brand)]'
                            : 'text-[var(--color-text-primary)]'
                        }`}
                      >
                        {theme.label}
                      </div>

                      <div className="truncate text-xs text-[var(--color-text-muted)]">
                        {theme.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                {t('appSettings.language')}
              </label>

              <select
                value={settings.language}
                onChange={(event) => updateSettings({ language: event.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
              >
                <option value="es">{t('settings.languageEs')}</option>
                <option value="en">{t('settings.languageEn')}</option>
              </select>
            </div>
          </section>

          {/* Comportamiento */}
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('appSettings.behavior')}
            </h3>

            <Toggle
              label={t('appSettings.openLastProject')}
              description={t('appSettings.openLastProjectDesc')}
              enabled={settings.openLastProjectOnStart}
              onChange={(value) => updateSettings({ openLastProjectOnStart: value })}
            />

            <Toggle
              label={t('appSettings.confirmBeforeClose')}
              description={t('appSettings.confirmBeforeCloseDesc')}
              enabled={settings.confirmBeforeClose}
              onChange={(value) => updateSettings({ confirmBeforeClose: value })}
            />
          </section>
        </div>
      </div>
    </div>
  );
};