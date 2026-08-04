import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, X, FileText, ArrowRight, Loader2, User, MapPin, Sword, Book, FlaskConical, StickyNote } from 'lucide-react';
import { useNavigationStore } from '../../store/navigationStore';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  rank: number;
  resultType: 'scene' | 'universe';
  category: string | null;
  categoryId: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  character: User,
  location: MapPin,
  item: Sword,
  race: User,
  organization: Book,
  note: StickyNote,
  research: FlaskConical,
};

export const SearchPanel: React.FC = () => {
  const { setActiveSceneId, setSelectedNodeId, setActiveView, setSelectedUniverse } = useNavigationStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await invoke<SearchResult[]>('search_all', {
        query: searchQuery.trim(),
      });
      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = window.setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.resultType === 'scene') {
      // Navigate to scene in manuscript
      setSelectedNodeId(result.id);
      setActiveSceneId(result.id);
      setActiveView('manuscript');
    } else {
      // Navigate to universe panel with category and entry selected
      setSelectedUniverse(result.categoryId, result.id);
      setActiveView('universe');
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const createMarkup = (snippet: string) => {
    return { __html: snippet };
  };

  const sceneResults = results.filter(r => r.resultType === 'scene');
  const universeResults = results.filter(r => r.resultType === 'universe');

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Buscar en el manuscrito
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Buscar escenas, personajes, lugares..."
            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {isSearching && (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Buscando...</span>
          </div>
        )}

        {/* No results */}
        {!isSearching && hasSearched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="w-10 h-10 mb-3 text-slate-700" />
            <p className="text-sm font-medium">No se encontraron resultados</p>
            <p className="text-xs mt-1">Prueba con otras palabras clave</p>
          </div>
        )}

        {/* Empty state before search */}
        {!hasSearched && !query && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Search className="w-10 h-10 mb-3 text-slate-700" />
            <p className="text-sm font-medium">Escribe para buscar</p>
            <p className="text-xs mt-1 max-w-xs text-center">
              Busca en el contenido de todas tus escenas y en el universo
            </p>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="p-2">
            {/* Scenes section */}
            {sceneResults.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-slate-500 px-2 py-1 uppercase tracking-wider">
                  Manuscritos ({sceneResults.length})
                </p>
                <div className="space-y-1">
                  {sceneResults.map((result) => (
                    <button
                      key={`scene-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left p-3 rounded-xl bg-slate-800/30 border border-transparent hover:bg-slate-800/60 hover:border-slate-700 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white truncate group-hover:text-violet-200 transition-colors">
                              {result.title}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <p
                            className="text-xs text-slate-400 line-clamp-2 leading-relaxed"
                            dangerouslySetInnerHTML={createMarkup(result.snippet)}
                          />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Universe section */}
            {universeResults.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 px-2 py-1 uppercase tracking-wider">
                  Universo ({universeResults.length})
                </p>
                <div className="space-y-1">
                  {universeResults.map((result) => {
                    const Icon = CATEGORY_ICONS[result.category ?? ''] ?? User;
                    return (
                      <button
                        key={`universe-${result.id}`}
                        onClick={() => handleResultClick(result)}
                        className="w-full text-left p-3 rounded-xl bg-slate-800/30 border border-transparent hover:bg-slate-800/60 hover:border-slate-700 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate group-hover:text-amber-200 transition-colors">
                                {result.title}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {result.category}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            {result.snippet && (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {result.snippet}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-slate-800/50 bg-slate-900/20">
        <p className="text-[10px] text-slate-600">
          Presiona{' '}
          <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            Esc
          </kbd>{' '}
          para cerrar
        </p>
      </div>
    </div>
  );
};
