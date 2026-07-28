import React from 'react';
import { FileText, FileCode, FileType, Globe, Download, ArrowLeft, FlaskConical } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useI18n } from '../../i18n';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown';

interface FormatInfo {
  id: ExportFormat;
  name: string;
  description: string;
  icon: React.ElementType;
  badge: string;
}

const formats: FormatInfo[] = [
  {
    id: 'pdf',
    name: 'PDF',
    description: 'Para imprenta o compartir documentos finalized',
    icon: FileText,
    badge: 'Experimental',
  },
  {
    id: 'docx',
    name: 'Word (DOCX)',
    description: 'Compatible con Microsoft Word y Google Docs',
    icon: FileType,
    badge: 'Experimental',
  },
  {
    id: 'html',
    name: 'HTML',
    description: 'Publicación web o para convertir a otros formatos',
    icon: Globe,
    badge: 'Experimental',
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Formato ligero para editores de texto avanzados',
    icon: FileCode,
    badge: 'Experimental',
  },
];

export const ExportPanel: React.FC = () => {
  const { t } = useI18n();
  const { setActiveView } = useWorkspaceStore();

  const handleExport = async (format: ExportFormat) => {
    // TODO: Implementar exportación cuando se agreguen los servicios
    console.log('Exportar como:', format);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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

      {/* Formatos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {formats.map((format) => {
          const Icon = format.icon;
          return (
            <button
              key={format.id}
              onClick={() => handleExport(format.id)}
              className="group relative flex items-start gap-4 p-5 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700/80 transition-all duration-200 text-left"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:from-amber-500/30 group-hover:to-orange-600/30 transition-all">
                <Icon className="w-5 h-5 text-amber-400" />
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
                <Download className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
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
