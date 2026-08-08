import React from 'react';
import { Tag, GitBranch, ArrowUpRight } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

const VERSION = '0.1.4';

interface ChangelogEntry {
  hash: string;
  message: string;
  type: 'feat' | 'fix' | 'refactor' | 'chore' | 'merge';
}

const changelog: ChangelogEntry[] = [
  {
    hash: '638fb209',
    message: 'Mejoras en la creación de carpetas y entradas, con validaciones para evitar nombres no válidos.',
    type: 'merge',
  },
  {
    hash: 'f7849f84',
    message: 'Ahora se comprueban los nombres al crear carpetas y entradas para evitar errores.',
    type: 'feat',
  },
  {
    hash: '8a5cbdf6',
    message: 'Mejoras en las pantallas vacías para mostrar información y orientación más útil.',
    type: 'merge',
  },
  {
    hash: '0477259d',
    message: 'Añadidas nuevas ilustraciones y mensajes para mejorar las pantallas sin contenido.',
    type: 'feat',
  },
  {
    hash: 'd21976b2',
    message: 'Nuevo editor de texto con mejoras en la escritura y el formato.',
    type: 'merge',
  },
  {
    hash: '3ae63c31',
    message: 'Nuevo editor de texto más completo, con mejor formato y compatibilidad al exportar documentos.',
    type: 'feat',
  },
  {
    hash: '4c293576',
    message: 'Mejoras en la personalización visual de la aplicación.',
    type: 'merge',
  },
  {
    hash: '9d90ae58',
    message: 'Añadidos nuevos temas visuales y mejoras generales en la apariencia de la aplicación.',
    type: 'feat',
  },
];

const typeColors: Record<ChangelogEntry['type'], string> = {
  feat: 'text-amber-400 bg-amber-400/10',
  fix: 'text-emerald-400 bg-emerald-400/10',
  refactor: 'text-violet-400 bg-violet-400/10',
  chore: 'text-slate-500 bg-slate-500/10',
  merge: 'text-sky-400 bg-sky-400/10',
};

const typeLabels: Record<ChangelogEntry['type'], string> = {
  feat: 'Nueva funcionalidad',
  fix: 'Corrección',
  refactor: 'Refactorización',
  chore: 'Tarea',
  merge: 'Merge',
};

export const ChangelogPanel: React.FC = () => {
  const openGitHub = async () => {
    try {
      await openUrl('https://github.com/sayghteight/culto-guieditor');
    } catch {
      window.open('https://github.com/sayghteight/culto-guieditor', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto pt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="text-xs uppercase tracking-widest text-amber-500 font-medium">Versión {VERSION}</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Últimos cambios</h1>
          <p className="text-sm text-slate-500 mt-1">{changelog.length} cambios desde la última release</p>
        </div>
        <button
          onClick={() => void openGitHub()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-400 transition-colors mt-1"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>Historial completo</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>

      {/* Changelog timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />

        <div className="space-y-1">
          {changelog.map((entry) => (
            <div key={entry.hash} className="relative flex gap-4 pl-6 py-2.5 group">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full border-2 border-slate-800 bg-slate-950 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-amber-500 transition-colors" />
              </div>

              {/* Hash */}
              <span className="text-[10px] font-mono text-slate-600 shrink-0 mt-0.5">{entry.hash}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColors[entry.type]}`}>
                    {typeLabels[entry.type]}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-snug">{entry.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
