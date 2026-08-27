import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Compass,
  FileText,
  ChevronRight,
  FolderPlus,
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import type { UniverseCategory } from '../../types';

// ─── UniverseIndex ─────────────────────────────────────────────────────────────

interface UniverseIndexProps {
  onSelectCategory: (categoryId: string) => void;
  onCreateEntry: () => void;
}

export const UniverseIndex: React.FC<UniverseIndexProps> = ({
  onSelectCategory,
  onCreateEntry,
}) => {
  const { categories, entries, isLoading, loadUniverse, createCategory } = useUniverseStore();

  const [searchInput, setSearchInput] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');

  useEffect(() => {
    loadUniverse();
  }, [loadUniverse]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(newCategoryName.trim(), newCategoryDesc.trim());
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowNewCategory(false);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };

  const getCategoryColor = (category: UniverseCategory) => {
    if (category.color) return category.color;
    return '#9090f0';
  };

  // Filter categories by search
  const filteredCategories = searchInput.trim()
    ? categories.filter(c =>
        c.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchInput.toLowerCase())
      )
    : categories;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-violet-600/10 via-slate-900/70 to-slate-950/90 p-6 shadow-lg shadow-slate-950/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-violet-300">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-violet-400">Universo</p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
                  Construye tu mundo
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-400">
                  Explora las categorías de tu enciclopedia narrativa.
                </p>
              </div>
            </div>
            <button
              onClick={onCreateEntry}
              className="flex items-center gap-2 rounded-xl border border-violet-500/50 bg-violet-600/20 px-4 py-2.5 text-sm font-medium text-violet-200 transition hover:border-violet-400 hover:bg-violet-600/30"
            >
              <Plus className="h-4 w-4" />
              Nueva entrada
            </button>
          </div>

          {/* Search Categories */}
          <div className="mt-6 relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar categorías..."
              className="w-full rounded-xl border border-slate-700/50 bg-slate-900/80 py-3 pl-12 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
          </div>
        </div>

        {/* Categories Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300">Categorías</h2>
            <button
              onClick={() => setShowNewCategory(!showNewCategory)}
              className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Nueva categoría
            </button>
          </div>

          {/* New Category Form */}
          {showNewCategory && (
            <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nombre de la categoría"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                />
                <input
                  type="text"
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="flex-[2] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
                >
                  Crear
                </button>
                <button
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName('');
                    setNewCategoryDesc('');
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Categories */}
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/20 py-16 text-center">
              <Compass className="h-12 w-12 text-slate-700" />
              <p className="mt-4 text-slate-400">
                {searchInput ? 'No se encontraron categorías' : 'No hay categorías todavía'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => {
                const count = entries.filter((e) => e.categoryId === category.id).length;
                const color = getCategoryColor(category);
                return (
                  <button
                    key={category.id}
                    onClick={() => onSelectCategory(category.id)}
                    className="group flex items-start gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        borderColor: `${color}40`,
                        backgroundColor: `${color}10`,
                      }}
                    >
                      <FileText className="h-5 w-5" color={color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-200 group-hover:text-white">
                          {category.name}
                        </h3>
                        <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {category.description || 'Sin descripción'}
                      </p>
                      <p className="mt-2 text-xs font-medium" style={{ color: color }}>
                        {count} {count === 1 ? 'entrada' : 'entradas'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UniverseIndex;
