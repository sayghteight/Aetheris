import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Replace, ChevronDown } from 'lucide-react';

interface FindReplaceDialogProps {
  text: string;
  onClose: () => void;
  onFindNext: (query: string) => void;
  onReplace: (query: string, replacement: string, all?: boolean) => void;
  initialQuery?: string;
}

export const FindReplaceDialog: React.FC<FindReplaceDialogProps> = ({
  text,
  onClose,
  onFindNext,
  onReplace,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [replaceWith, setReplaceWith] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = text.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } else {
      setMatchCount(0);
    }
  }, [query, text]);

  const handleFindNext = useCallback(() => {
    if (query.trim()) {
      onFindNext(query);
    }
  }, [query, onFindNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleReplace();
      } else {
        handleFindNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleReplace = () => {
    if (query.trim()) {
      onReplace(query, replaceWith);
    }
  };

  const handleReplaceAll = () => {
    if (query.trim()) {
      onReplace(query, replaceWith, true);
    }
  };

  return (
    <div className="absolute top-0 right-0 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
        <span className="text-xs font-semibold text-slate-200">Buscar y reemplazar</span>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
          />
          {matchCount > 0 && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
              {matchCount}
            </span>
          )}
        </div>

        {/* Replace input */}
        <div className="relative">
          <Replace className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reemplazar con..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFindNext}
            disabled={!query.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-200 rounded-lg transition-colors"
            title="Buscar siguiente"
          >
            <ChevronDown className="w-3 h-3" />
            <span>Siguiente</span>
          </button>

          <button
            onClick={handleReplace}
            disabled={!query.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-slate-200 rounded-lg transition-colors"
            title="Reemplazar siguiente"
          >
            <Replace className="w-3 h-3" />
            <span>Reemplazar</span>
          </button>

          <button
            onClick={handleReplaceAll}
            disabled={!query.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-white rounded-lg transition-colors"
            title="Reemplazar todo"
          >
            <span>Todo</span>
          </button>

          <div className="ml-auto text-[10px] text-slate-500">
            {isMac ? '⌘' : 'Ctrl'}+Enter = Buscar
          </div>
        </div>

        <div className="text-[10px] text-slate-600">
          {isMac ? '⇧' : 'Shift'}+Enter = Reemplazar · Esc = Cerrar
        </div>
      </div>
    </div>
  );
};
