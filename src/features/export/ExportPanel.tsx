import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { FileText, FileCode, FileType, Globe, Download, ArrowLeft, FlaskConical, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown';

interface FormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  icon: React.ElementType;
  extension: string;
  badge: string;
}

const formats: FormatInfo[] = [
  {
    id: 'pdf',
    name: 'PDF',
    description: 'Para imprenta o compartir documentos finalizados',
    icon: FileText,
    extension: 'pdf',
    badge: 'Experimental',
  },
  {
    id: 'docx',
    name: 'Word (DOCX)',
    description: 'Compatible con Microsoft Word y Google Docs',
    icon: FileType,
    extension: 'docx',
    badge: 'Experimental',
  },
  {
    id: 'html',
    name: 'HTML',
    description: 'Publicación web o para convertir a otros formatos',
    icon: Globe,
    extension: 'html',
    badge: 'Experimental',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Formato ligero para editores de texto avanzados',
    icon: FileCode,
    extension: 'md',
    badge: 'Experimental',
  },
];

export const ExportPanel: React.FC = () => {
  const { setActiveView } = useWorkspaceStore();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: FormatInfo) => {
    setExporting(format.id);
    setError(null);

    try {
      const filePath = await save({
        filters: [{
          name: format.name,
          extensions: [format.extension],
        }],
        defaultPath: `manuscript.${format.extension}`,
      });

      if (!filePath) {
        setExporting(null);
        return;
      }

      // Generate file in Rust
      const data: number[] = await invoke('export_manuscript', { format: format.id });

      // Save file using Rust command
      await invoke('save_exported_file', { path: filePath, data });

    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al exportar');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveView('manuscript')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al manuscrito
        </button>
        <div className="h-4 w-px bg-slate-800" />
        <div>
          <h2 className="text-xl font-bold text-white">Exportar proyecto</h2>
          <p className="text-sm text-slate-400">Descarga tu manuscrito en el formato que prefieras</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Formatos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {formats.map((format) => {
          const Icon = format.icon;
          const isExporting = exporting === format.id;

          return (
            <button
              key={format.id}
              onClick={() => handleExport(format)}
              disabled={exporting !== null}
              className="group relative flex items-start gap-4 p-5 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700/80 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:from-amber-500/30 group-hover:to-orange-600/30 transition-all">
                {isExporting ? (
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5 text-amber-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold">{format.name}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    <FlaskConical className="w-2.5 h-2.5" />
                    {format.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{format.description}</p>
              </div>

              {/* Download indicator */}
              <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {isExporting ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-4">
        <p className="text-xs text-slate-500">
          Los formatos marcados como experimentales pueden tener limitaciones. Si encuentras algún problema, repórtalo en el repositorio de GitHub.
        </p>
      </div>
    </div>
  );
};
