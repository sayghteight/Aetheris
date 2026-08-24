import React, { useEffect, useState } from 'react';
import { Tag, GitBranch, ArrowUpRight, FlaskConical } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';

import { VERSION } from '../../utils/version';

interface GitCommit {
  hash: string;
  message: string;
  date: string;
}

interface GitTag {
  name: string;
  hash: string;
  date: string;
}

interface TagInfo {
  current_tag: string | null;
  commits_since_tag: GitCommit[];
  all_tags: GitTag[];
}

const typeColors: Record<string, string> = {
  feat: 'text-amber-400 bg-amber-400/10',
  fix: 'text-emerald-400 bg-emerald-400/10',
  refactor: 'text-violet-400 bg-violet-400/10',
  chore: 'text-slate-500 bg-slate-500/10',
  merge: 'text-sky-400 bg-sky-400/10',
};

const typeLabels: Record<string, string> = {
  feat: 'Nueva funcionalidad',
  fix: 'Corrección',
  refactor: 'Refactorización',
  chore: 'Tarea',
  merge: 'Merge',
};

const detectType = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.startsWith('feat') || lower.includes('add') || lower.includes('nuevo')) return 'feat';
  if (lower.startsWith('fix')) return 'fix';
  if (lower.startsWith('refactor') || lower.includes('refactor')) return 'refactor';
  if (lower.startsWith('merge') || lower.includes('merge')) return 'merge';
  return 'chore';
};

export const ChangelogPanel: React.FC = () => {
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGitInfo = async () => {
      try {
        const info = await invoke<TagInfo>('get_git_tags');
        setTagInfo(info);
      } catch (err) {
        console.error('Failed to load git tags:', err);
      } finally {
        setLoading(false);
      }
    };
    void loadGitInfo();
  }, []);

  const openGitHub = async () => {
    try {
      await openUrl('https://github.com/sayghteight/culto-guieditor');
    } catch {
      window.open('https://github.com/sayghteight/culto-guieditor', '_blank', 'noopener,noreferrer');
    }
  };

  const displayVersion = tagInfo?.current_tag?.replace('app-v', 'v') ?? VERSION;
  const commits = tagInfo?.commits_since_tag ?? [];

  return (
    <div className="max-w-2xl w-full mx-auto pt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-amber-500" />
            <span className="text-xs uppercase tracking-widest text-amber-500 font-medium">
              {displayVersion}
            </span>
            {tagInfo?.current_tag ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                <FlaskConical className="w-2.5 h-2.5" />
                {tagInfo.all_tags.length > 1 ? 'Historical' : 'Latest'}
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Últimos cambios</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Cargando...' : `${commits.length} cambios desde la última release`}
          </p>
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
          {commits.map((entry) => {
            const entryType = detectType(entry.message);
            return (
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
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeColors[entryType]}`}>
                      {typeLabels[entryType]}
                    </span>
                    <span className="text-[10px] text-slate-600">{entry.date}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{entry.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
