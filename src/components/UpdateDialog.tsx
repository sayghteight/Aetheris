import React, { useState, useEffect } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-updater';
import { Dialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { Download, X, RefreshCw } from 'lucide-react';

interface UpdateInfo {
  version: string;
  notes?: string;
}

export const UpdateDialog: React.FC = () => {
  const { t } = useI18n();
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await check();
      if (update?.available) {
        setUpdateAvailable({
          version: update.version,
          notes: update.body || undefined,
        });
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  const handleUpdate = async () => {
    if (!updateAvailable) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const update = await check();
      if (update?.downloadAndInstall) {
        update.downloadAndInstall((event) => {
          if (event.event === 'Progress') {
            const total = event.data.contentLength || 1;
            const downloaded = event.data.chunkLength || 0;
            setDownloadProgress(Math.round((downloaded / total) * 100));
          }
        });
      }

      // Restart after install
      await relaunch();
    } catch (error) {
      console.error('Update failed:', error);
      setIsDownloading(false);
    }
  };

  const handleLater = () => {
    setUpdateAvailable(null);
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Nueva versión disponible</h3>
            <p className="text-sm text-slate-400">v{updateAvailable.version}</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          Hay una nueva versión del editor. ¿Quieres actualizar ahora?
        </p>

        {updateAvailable.notes && (
          <div className="bg-slate-800/50 rounded-lg p-3 mb-4 max-h-32 overflow-auto">
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{updateAvailable.notes}</p>
          </div>
        )}

        {isDownloading && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Descargando...</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleLater}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Más tarde
          </button>
          <button
            onClick={handleUpdate}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <>
                <Download className="w-4 h-4 animate-pulse" />
                Descargando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
