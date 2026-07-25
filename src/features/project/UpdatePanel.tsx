import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownToLine, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  body?: string;
  published_at?: string;
}

const CURRENT_VERSION = '0.1.0';
const DEFAULT_REPOSITORY = 'sayghteight/culto-guieditor';
const REPOSITORY = import.meta.env.VITE_GITHUB_REPO || DEFAULT_REPOSITORY;

function normalizeVersion(version: string): string {
  return version.replace(/^v/i, '').trim();
}

function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split(/[.-]/)[0].split('.').map((part) => Number(part) || 0);
  const rightParts = normalizeVersion(right).split(/[.-]/)[0].split('.').map((part) => Number(part) || 0);

  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
}

export const UpdatePanel: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [release, setRelease] = useState<GitHubRelease | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'culto-guieditor',
        },
      });

      if (!response.ok) {
        throw new Error('No se pudo obtener la información de releases desde GitHub.');
      }

      const data: GitHubRelease = await response.json();
      setRelease(data);
      setStatus('success');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Ha ocurrido un error inesperado.';
      setError(message);
      setStatus('error');
    }
  };

  useEffect(() => {
    void checkForUpdates();
  }, []);

  const hasNewVersion = useMemo(() => {
    if (!release?.tag_name) return false;
    return compareVersions(release.tag_name, CURRENT_VERSION) > 0;
  }, [release]);

  const openRelease = async () => {
    if (!release?.html_url) return;

    try {
      await openUrl(release.html_url);
    } catch {
      window.open(release.html_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-violet-400">Actualizaciones</p>
        <h2 className="text-2xl font-extrabold tracking-tight mt-2">Gestión de versiones</h2>
        <p className="text-sm text-slate-400 mt-2">
          Comprobamos el repositorio de GitHub y te mostramos si hay una nueva release disponible para instalar.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">Versión instalada</p>
            <p className="text-xs text-slate-500">{CURRENT_VERSION}</p>
          </div>
          <button
            onClick={() => void checkForUpdates()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-300 transition hover:border-violet-500 hover:text-white"
          >
            {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Comprobar ahora
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {status === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Revisando releases en GitHub...
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2 text-sm text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">No se pudo comprobar la actualización.</p>
                <p className="text-slate-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {status === 'success' && !release && (
            <div className="text-sm text-slate-400">No hay información de releases disponible para este repositorio.</div>
          )}

          {status === 'success' && release && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-slate-800/70 bg-slate-900/70 p-4">
                {hasNewVersion ? (
                  <ArrowDownToLine className="mt-0.5 h-5 w-5 text-emerald-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />
                )}
                <div>
                  <p className="font-semibold text-slate-200">
                    {hasNewVersion ? `Nueva versión disponible: ${release.tag_name}` : 'Tu instalación está al día.'}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {release.name || release.tag_name || 'Release publicada recientemente'}
                  </p>
                  {release.body && (
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-500">{release.body}</p>
                  )}
                </div>
              </div>

              {hasNewVersion ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void openRelease()}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Abrir release para actualizar
                  </button>
                  <span className="text-xs text-slate-500">
                    Se abrirá la página de la release en tu navegador para completar la instalación.
                  </span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">La versión actual ya está instalada. Revisa de nuevo más adelante si publican nuevas releases.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
