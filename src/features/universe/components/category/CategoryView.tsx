import React, { useMemo } from 'react';
import { ArrowLeft, Plus, FileText, Star } from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import type { EntryType } from '../../types';
import { getEntryTypeColor } from '../../types';

const typeIcons: Record<EntryType, React.ComponentType<{ className?: string; color?: string }>> = {
  character: FileText,
  location: FileText,
  faction: FileText,
  kingdom: FileText,
  creature: FileText,
  item: FileText,
  event: FileText,
  concept: FileText,
  other: FileText,
};

interface CategoryViewProps {
  categoryId: string;
  onSelectEntry: (entryId: string) => void;
  onBack: () => void;
  onCreateEntry: () => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  categoryId,
  onSelectEntry,
  onBack,
  onCreateEntry,
}) => {
  const { entries, categories, entryTypes } = useUniverseStore();

  const category = useMemo(
    () => categories.find(c => c.id === categoryId),
    [categories, categoryId]
  );

  const categoryEntries = useMemo(
    () => entries.filter(e => e.categoryId === categoryId),
    [entries, categoryId]
  );

  if (!category) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-slate-400">Categoría no encontrada</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{category.name}</h1>
            {category.description && (
              <p className="mt-1 text-sm text-slate-400">{category.description}</p>
            )}
          </div>
          <button
            onClick={onCreateEntry}
            className="ml-auto flex items-center gap-2 rounded-xl border border-violet-500/50 bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-200 transition hover:border-violet-400 hover:bg-violet-600/30"
          >
            <Plus className="h-4 w-4" />
            Nueva entrada
          </button>
        </div>

        {/* Entries Grid */}
        {categoryEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/20 py-16 text-center">
            <FileText className="h-12 w-12 text-slate-700" />
            <p className="mt-4 text-slate-400">No hay entradas en esta categoría</p>
            <button
              onClick={onCreateEntry}
              className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600/20 px-4 py-2 text-sm text-violet-300 transition hover:bg-violet-600/30"
            >
              <Plus className="h-4 w-4" />
              Crear primera entrada
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categoryEntries.map((entry) => {
              const Icon = typeIcons[entry.entryType] || FileText;
              const color = getEntryTypeColor(entry.entryType);
              const typeName = entryTypes.find(t => t.id === entry.entryType)?.nameEs || entry.entryType;

              return (
                <button
                  key={entry.id}
                  onClick={() => onSelectEntry(entry.id)}
                  className="group flex flex-col rounded-xl border border-slate-800/60 bg-slate-900/40 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: `${color}40`,
                        backgroundColor: `${color}10`,
                      }}
                    >
                      <Icon className="h-5 w-5" color={color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-200 group-hover:text-white">
                        {entry.name}
                      </h3>
                      <p className="text-xs text-slate-500">{typeName}</p>
                    </div>
                    {entry.isFeatured && (
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    )}
                  </div>
                  {entry.briefDescription && (
                    <p className="line-clamp-2 text-xs text-slate-400">
                      {entry.briefDescription}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1 pt-2">
                    {entry.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryView;
