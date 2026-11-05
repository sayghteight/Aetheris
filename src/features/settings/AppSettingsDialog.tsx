import React, { useEffect, useState } from 'react';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { invoke } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';
import {
  AppSettings,
  AppTheme,
  DEFAULT_APP_SETTINGS,
  EditorFontFamily,
  EditorTextAlign,
  useAppSettingsStore,
} from '../../store/appSettingsStore';
import { SHORTCUT_DEFINITIONS, useShortcutsStore } from '../../store/shortcutsStore';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import {
  X,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Zap,
  FolderOpen,
  RotateCcw,
  Minus,
  Plus,
} from 'lucide-react';

/** Resoluciones ofrecidas ademas del tamano del monitor. */
const RESOLUTION_PRESETS = [
  { width: 1024, height: 640 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1600, height: 1000 },
  { width: 1920, height: 1080 },
];

/** Niveles de zoom de la interfaz. */
const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];

/** Retardos ofrecidos para el autoguardado, en milisegundos. */
const AUTO_SAVE_DELAYS = [700, 1000, 2000, 5000, 15000, 30000, 60000];

/** Alturas de la banda de escritura centrada, en porcentaje. */
const CENTERED_POSITIONS = [30, 40, 50, 60];

/** Limites de la ventana: coinciden con `minWidth`/`minHeight` de tauri.conf.json. */
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
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="mb-8 last:mb-0">
    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {title}
    </h3>
    {children}
  </section>
);

/** Selector numerico con botones de mas y menos. */
const Stepper: React.FC<{
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}> = ({ label, value, onDecrease, onIncrease }) => (
  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
    <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {label}
    </label>
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrease}
        className="lib-ring flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        aria-label={`${label} -`}
      >
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex-1 text-center text-xl font-bold text-[var(--color-text-primary)]">
        {value}
      </div>
      <button
        type="button"
        onClick={onIncrease}
        className="lib-ring flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
        aria-label={`${label} +`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  </div>
);

interface AppSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AppSettingsDialog: React.FC<AppSettingsDialogProps> = ({ open, onClose }) => {
  const { t } = useI18n();
  const { settings, updateSettings } = useAppSettingsStore();
  const { shortcuts, loadShortcuts, setShortcut, resetToDefaults } = useShortcutsStore();
  const [monitorSize, setMonitorSize] = useState<{ width: number; height: number } | null>(null);
  const [customWidth, setCustomWidth] = useState(String(settings.windowWidth));
  const [customHeight, setCustomHeight] = useState(String(settings.windowHeight));
  /** Se enciende cuando una operacion sobre la ventana no se puede aplicar. */
  const [windowError, setWindowError] = useState(false);

  /**
   * Resolucion elegida en el desplegable: un preset del catalogo, el tamano
   * del monitor o "custom" para escribir una medida a mano. Los campos de
   * ancho y alto solo se activan en ese ultimo caso.
   */
  const [resolutionValue, setResolutionValue] = useState<string>(() => {
    const preset = RESOLUTION_PRESETS.find(
      (item) => item.width === settings.windowWidth && item.height === settings.windowHeight
    );
    return preset ? `${preset.width}x${preset.height}` : 'custom';
  });
  const isCustomResolution = resolutionValue === 'custom';

  // Tamano del monitor, para ofrecer la resolucion maxima disponible.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    currentMonitor()
      .then((monitor) => {
        if (cancelled || !monitor) return;
        const logical = monitor.size.toLogical(monitor.scaleFactor);
        setMonitorSize({
          width: Math.round(logical.width),
          height: Math.round(logical.height),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    loadShortcuts();
  }, [loadShortcuts]);

  // Los campos de resolucion reflejan siempre el tamano guardado.
  useEffect(() => {
    setCustomWidth(String(settings.windowWidth));
    setCustomHeight(String(settings.windowHeight));
    const preset = RESOLUTION_PRESETS.find(
      (item) => item.width === settings.windowWidth && item.height === settings.windowHeight
    );
    setResolutionValue(preset ? `${preset.width}x${preset.height}` : 'custom');
  }, [settings.windowWidth, settings.windowHeight]);

  // Escape cierra el dialogo.
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
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  /**
   * Sincroniza los ajustes con el estado real de la ventana al abrir el
   * dialogo: el usuario puede haber maximizado la ventana desde el titulo.
   *
   * Este efecto va antes del `return null` de abajo: un hook que solo se
   * ejecuta con el dialogo abierto cambia el numero de hooks entre renders y
   * React tumba la aplicacion.
   */
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        const [isFullscreen, isMaximized, size, scale] = await Promise.all([
          appWindow.isFullscreen(),
          appWindow.isMaximized(),
          // El tamaño exterior es el que aplican `set_size` y `setSize`.
          appWindow.outerSize(),
          appWindow.scaleFactor(),
        ]);
        if (cancelled) return;

        const patch: Partial<AppSettings> = {
          windowFullscreen: isFullscreen,
          windowMaximized: isMaximized,
        };
        // El tamaño solo se guarda si la ventana esta en su tamano normal: si
        // esta maximizada, ese valor no sirve para restaurarla al arrancar.
        if (!isMaximized && !isFullscreen) {
          patch.windowWidth = Math.round(size.width / scale);
          patch.windowHeight = Math.round(size.height / scale);
        }
        await updateSettings(patch);
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, updateSettings]);

  if (!open) return null;

  /**
   * En Windows una ventana maximizada o en pantalla completa ignora el
   * cambio de tamano, asi que hay que salir de ese estado antes de
   * redimensionarla.
   */
  const leaveSpecialState = async () => {
    const appWindow = getCurrentWindow();
    if (await appWindow.isFullscreen()) {
      await appWindow.setFullscreen(false);
      await updateSettings({ windowFullscreen: false });
    }
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
      await updateSettings({ windowMaximized: false });
    }
  };

  const applyResolution = async (width: number, height: number) => {
    const w = Math.max(MIN_WIDTH, Math.min(Math.round(width), 4000));
    const h = Math.max(MIN_HEIGHT, Math.min(Math.round(height), 3000));

    try {
      setWindowError(false);
      await leaveSpecialState();
      await getCurrentWindow().setSize(new LogicalSize(w, h));
      await updateSettings({
        windowWidth: w,
        windowHeight: h,
        windowMaximized: false,
        windowFullscreen: false,
      });
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  /** Al elegir un preset se aplica al instante; "custom" solo habilita los campos. */
  const handleResolutionChange = async (value: string) => {
    setResolutionValue(value);
    if (value === 'custom') {
      setCustomWidth(String(settings.windowWidth));
      setCustomHeight(String(settings.windowHeight));
      return;
    }
    const [w, h] = value.split('x').map(Number);
    if (w && h) await applyResolution(w, h);
  };

  const applyCustomResolution = async () => {
    await applyResolution(Number(customWidth), Number(customHeight));
  };

  const setFullscreen = async (value: boolean) => {
    try {
      setWindowError(false);
      const appWindow = getCurrentWindow();
      // Windows no admite pasar a pantalla completa desde una ventana maximizada.
      if (value && (await appWindow.isMaximized())) {
        await appWindow.unmaximize();
        await updateSettings({ windowMaximized: false });
      }
      await appWindow.setFullscreen(value);
      await updateSettings({ windowFullscreen: value });
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  const toggleMaximize = async () => {
    try {
      setWindowError(false);
      const appWindow = getCurrentWindow();
      if (await appWindow.isFullscreen()) {
        await appWindow.setFullscreen(false);
        await updateSettings({ windowFullscreen: false });
      }
      await appWindow.toggleMaximize();
      await updateSettings({ windowMaximized: await appWindow.isMaximized() });
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  const centerWindow = async () => {
    try {
      setWindowError(false);
      await getCurrentWindow().center();
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  const toggleAlwaysOnTop = async (value: boolean) => {
    try {
      setWindowError(false);
      await getCurrentWindow().setAlwaysOnTop(value);
      await updateSettings({ alwaysOnTop: value });
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  const toggleResizable = async (value: boolean) => {
    try {
      setWindowError(false);
      await getCurrentWindow().setResizable(value);
      await updateSettings({ resizable: value });
    } catch (error) {
      console.error(error);
      setWindowError(true);
    }
  };

  const changeZoom = async (value: number) => {
    try {
      await getCurrentWebview().setZoom(value);
      await updateSettings({ interfaceZoom: value });
    } catch (error) {
      console.error(error);
    }
  };

  const openDataFolder = async () => {
    try {
      const path = await invoke<string>('get_app_data_dir');
      await revealItemInDir(path);
    } catch (error) {
      console.error(error);
    }
  };

  const resetAppSettings = async () => {
    try {
      await updateSettings(DEFAULT_APP_SETTINGS);
      await getCurrentWebview().setZoom(DEFAULT_APP_SETTINGS.interfaceZoom);
      await getCurrentWindow().setResizable(DEFAULT_APP_SETTINGS.resizable);
      await getCurrentWindow().setAlwaysOnTop(DEFAULT_APP_SETTINGS.alwaysOnTop);
      await leaveSpecialState();
      await getCurrentWindow().setSize(
        new LogicalSize(DEFAULT_APP_SETTINGS.windowWidth, DEFAULT_APP_SETTINGS.windowHeight)
      );
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
      desc: t('settingsProject.neonCyan'),
      icon: Zap,
      bg: 'bg-gradient-to-br from-[#080a0d] to-[#181c24]',
      accent: 'text-[#50e8e0]',
      border: 'border-[#28303d]',
    },
    {
      value: 'light',
      label: t('appSettings.themeLight'),
      desc: t('appSettings.themeLightDesc'),
      icon: Sun,
      bg: 'bg-gradient-to-br from-[#fdfbf7] to-[#ece5d8]',
      accent: 'text-[#a97a09]',
      border: 'border-[#ddd5c7]',
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
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('appSettings.subtitle')}</p>
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
          {/* ── Ventana ── */}
          <Section title={t('appSettings.window')}>
            <Toggle
              label={t('appSettings.fullscreen')}
              description={t('appSettings.fullscreenDesc')}
              enabled={settings.windowFullscreen}
              onChange={setFullscreen}
            />

            {windowError && (
              <p className="mb-2 mt-1 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-bg)] px-3 py-2 text-xs text-[var(--color-danger)]">
                {t('appSettings.windowError')}
              </p>
            )}

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
                  value={resolutionValue}
                  onChange={(event) => handleResolutionChange(event.target.value)}
                  aria-label={t('appSettings.resolution')}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  {RESOLUTION_PRESETS.map((preset) => (
                    <option key={`${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                      {preset.width} × {preset.height}
                    </option>
                  ))}
                  {monitorSize && (
                    <option value={`${monitorSize.width}x${monitorSize.height}`}>
                      {t('appSettings.monitorSize')} ({monitorSize.width} × {monitorSize.height})
                    </option>
                  )}
                  <option value="custom">{t('appSettings.customResolution')}</option>
                </select>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={MIN_WIDTH}
                    max={4000}
                    disabled={!isCustomResolution}
                    value={customWidth}
                    onChange={(event) => setCustomWidth(event.target.value)}
                    className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-45`}
                    aria-label={t('appSettings.customWidth')}
                  />
                  <span className="text-[var(--color-text-muted)]">×</span>
                  <input
                    type="number"
                    min={MIN_HEIGHT}
                    max={3000}
                    disabled={!isCustomResolution}
                    value={customHeight}
                    onChange={(event) => setCustomHeight(event.target.value)}
                    className={`w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-45`}
                    aria-label={t('appSettings.customHeight')}
                  />
                </div>
              </div>

              {isCustomResolution && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t('appSettings.customResolutionHint')}
                  </p>
                  <button
                    type="button"
                    onClick={applyCustomResolution}
                    className="lib-ring shrink-0 rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-brand)]/20"
                  >
                    {t('appSettings.apply')}
                  </button>
                </div>
              )}

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
                  {settings.windowMaximized ? t('appSettings.restore') : t('appSettings.maximize')}
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
                label={t('appSettings.alwaysOnTop')}
                description={t('appSettings.alwaysOnTopDesc')}
                enabled={settings.alwaysOnTop}
                onChange={toggleAlwaysOnTop}
              />
              <Toggle
                label={t('appSettings.resizable')}
                description={t('appSettings.resizableDesc')}
                enabled={settings.resizable}
                onChange={toggleResizable}
              />
              <Toggle
                label={t('appSettings.restoreWindow')}
                description={t('appSettings.restoreWindowDesc')}
                enabled={settings.restoreWindowOnStart}
                onChange={(value) => updateSettings({ restoreWindowOnStart: value })}
              />
            </div>
          </Section>

          {/* ── Apariencia ── */}
          <Section title={t('appSettings.appearance')}>
            <div className="grid gap-3 sm:grid-cols-3">
              {themes.map((theme) => {
                const Icon = theme.icon;
                const isActive = settings.theme === theme.value;

                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => updateSettings({ theme: theme.value })}
                    aria-label={theme.label}
                    aria-pressed={isActive}
                    className={`lib-ring flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                      isActive
                        ? 'border-[var(--color-brand)] bg-[var(--color-brand-bg)]'
                        : 'border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-text-muted)]'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border shadow-lg ${theme.bg} ${theme.border}`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? theme.accent : 'text-[var(--color-text-muted)]'}`} />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold ${isActive ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]'}`}
                      >
                        {theme.label}
                      </div>
                      <div className="truncate text-xs text-[var(--color-text-muted)]">{theme.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
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

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.interfaceZoom')}
                </label>
                <select
                  value={String(settings.interfaceZoom)}
                  onChange={(event) => changeZoom(Number(event.target.value))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  {ZOOM_LEVELS.map((level) => (
                    <option key={level} value={String(level)}>
                      {Math.round(level * 100)} %
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {t('appSettings.interfaceZoomDesc')}
            </p>
          </Section>

          {/* ── Escritura ── */}
          <Section title={t('appSettings.writing')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.fontFamily')}
                </label>
                <select
                  value={settings.fontFamily}
                  onChange={(event) =>
                    updateSettings({ fontFamily: event.target.value as EditorFontFamily })
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="serif">{t('appSettings.fontSerif')}</option>
                  <option value="sans">{t('appSettings.fontSans')}</option>
                  <option value="mono">{t('appSettings.fontMono')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.textAlign')}
                </label>
                <select
                  value={settings.textAlign}
                  onChange={(event) =>
                    updateSettings({ textAlign: event.target.value as EditorTextAlign })
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="left">{t('appSettings.alignLeft')}</option>
                  <option value="justify">{t('appSettings.alignJustify')}</option>
                  <option value="center">{t('appSettings.alignCenter')}</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stepper
                label={t('appSettings.fontSize')}
                value={`${settings.fontSize} px`}
                onDecrease={() => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) })}
                onIncrease={() => updateSettings({ fontSize: Math.min(28, settings.fontSize + 1) })}
              />
              <Stepper
                label={t('appSettings.lineHeight')}
                value={settings.lineHeight.toFixed(1)}
                onDecrease={() =>
                  updateSettings({
                    lineHeight: Math.max(1.2, Number((settings.lineHeight - 0.05).toFixed(2))),
                  })
                }
                onIncrease={() =>
                  updateSettings({
                    lineHeight: Math.min(2.4, Number((settings.lineHeight + 0.05).toFixed(2))),
                  })
                }
              />
            </div>

            <div className="mt-2">
              <Toggle
                label={t('appSettings.showWordCount')}
                description={t('appSettings.showWordCountDesc')}
                enabled={settings.showWordCount}
                onChange={(value) => updateSettings({ showWordCount: value })}
              />
              <Toggle
                label={t('appSettings.centeredWriting')}
                description={t('appSettings.centeredWritingDesc')}
                enabled={settings.centeredWritingMode}
                onChange={(value) => updateSettings({ centeredWritingMode: value })}
              />
            </div>

            {settings.centeredWritingMode && (
              <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4">
                <label className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {t('appSettings.cursorPosition')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CENTERED_POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateSettings({ centeredWritingPosition: pos })}
                      className={`lib-ring rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        settings.centeredWritingPosition === pos
                          ? 'bg-[var(--color-brand)] text-white'
                          : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {pos}%
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {t('appSettings.cursorPositionDesc')}
                </p>
              </div>
            )}
          </Section>

          {/* ── Atajos de teclado ── */}
          <Section title={t('appSettings.shortcuts')}>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              {t('appSettings.shortcutsDesc')}
            </p>

            <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4">
              {SHORTCUT_DEFINITIONS.map((definition) => (
                <div
                  key={definition.action}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {t(`shortcuts.${definition.action}`)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t(`shortcuts.${definition.action}Desc`)}
                    </p>
                  </div>
                  <ShortcutRecorder
                    shortcut={shortcuts[definition.action]}
                    onSave={(shortcut) => setShortcut(definition.action, shortcut)}
                    onCancel={() => {}}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={resetToDefaults}
              className="lib-ring mt-3 flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('appSettings.resetShortcuts')}
            </button>
          </Section>

          {/* ── Comportamiento ── */}
          <Section title={t('appSettings.behavior')}>
            <Toggle
              label={t('appSettings.autoSave')}
              description={t('appSettings.autoSaveDesc')}
              enabled={settings.autoSaveEnabled}
              onChange={(value) => updateSettings({ autoSaveEnabled: value })}
            />

            {settings.autoSaveEnabled && (
              <div className="ml-1 mt-1 max-w-xs">
                <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.autoSaveDelay')}
                </label>
                <select
                  value={String(settings.autoSaveDelayMs)}
                  onChange={(event) =>
                    updateSettings({ autoSaveDelayMs: Number(event.target.value) })
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
                >
                  {AUTO_SAVE_DELAYS.map((delay) => (
                    <option key={delay} value={String(delay)}>
                      {delay < 1000 ? `${delay} ms` : `${delay / 1000} s`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {t('appSettings.autoSaveDelayDesc')}
                </p>
              </div>
            )}

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
          </Section>

          {/* ── Datos ── */}
          <Section title={t('appSettings.data')}>
            <button
              type="button"
              onClick={openDataFolder}
              className="lib-ring flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.openDataFolder')}
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {t('appSettings.openDataFolderDesc')}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={resetAppSettings}
              className="lib-ring mt-3 flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 text-left transition-colors hover:bg-[var(--color-bg-hover)]"
            >
              <RotateCcw className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('appSettings.resetApp')}
                </span>
                <span className="block text-xs text-[var(--color-text-muted)]">
                  {t('appSettings.resetAppDesc')}
                </span>
              </span>
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
};
