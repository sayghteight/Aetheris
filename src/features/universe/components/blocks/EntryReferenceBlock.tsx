import React, { useState, useMemo } from 'react';
import { FileText, Search, X } from 'lucide-react';
import type { UniverseBlock, BlockContent, UniverseEntry } from '../../types';
import { useUniverseStore } from '../../store/universeStore';

interface EntryReferenceBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const EntryReferenceBlock: React.FC<EntryReferenceBlockProps> = ({ block, onUpdate, isEditing }) => {
  const content = block.content as {
    type: 'entry-reference';
    entryId: string;
    displayMode: 'card' | 'inline' | 'badge';
    note?: string;
  };

  const { entries, entryTypes } = useUniverseStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === content.entryId),
    [entries, content.entryId]
  );

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 10);
  }, [entries, searchQuery]);

  const getEntryTypeName = (entryTypeId: string) => {
    return entryTypes.find((t) => t.id === entryTypeId)?.nameEs || entryTypeId;
  };

  const handleSelectEntry = (entry: UniverseEntry) => {
    onUpdate({
      ...content,
      entryId: entry.id,
      displayMode: content.displayMode || 'card',
    });
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleRemoveReference = () => {
    onUpdate({
      type: 'entry-reference',
      entryId: '',
      displayMode: content.displayMode || 'card',
      note: '',
    });
  };

  if (!isEditing) {
    if (!content.entryId) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Sin referencia</p>
          </div>
        </div>
      );
    }

    const entryName = selectedEntry?.name || content.entryId;
    const entryType = selectedEntry ? getEntryTypeName(selectedEntry.entryType) : '';

    if (content.displayMode === 'badge') {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-600/20 px-3 py-1 text-xs text-violet-300 border border-violet-500/30">
            <FileText className="h-3 w-3" />
            {entryName}
          </span>
          {entryType && <span className="text-xs text-slate-500">({entryType})</span>}
          {content.note && <span className="text-xs text-slate-600 italic">- {content.note}</span>}
        </div>
      );
    }

    if (content.displayMode === 'inline') {
      return (
        <div className="flex items-center gap-2">
          <span className="text-violet-400 hover:text-violet-300 underline cursor-pointer">
            → {entryName}
          </span>
          {entryType && <span className="text-xs text-slate-500">({entryType})</span>}
          {content.note && <span className="text-xs text-slate-600 italic">- {content.note}</span>}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-600/10 px-4 py-3">
          <FileText className="h-5 w-5 text-violet-400" />
          <div>
            <span className="text-sm text-violet-200">{entryName}</span>
            {entryType && <span className="ml-2 text-xs text-slate-500">({entryType})</span>}
          </div>
        </div>
        {content.note && (
          <p className="text-xs text-slate-500 italic pl-2">Nota: {content.note}</p>
        )}
      </div>
    );
  }

  // Editing mode
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">Referencia a entrada</span>
      </div>

      {/* Selected Entry Display */}
      {selectedEntry ? (
        <div className="relative rounded-lg border border-violet-500/30 bg-violet-600/10 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-violet-200">{selectedEntry.name}</span>
              <span className="ml-2 text-xs text-slate-500">
                ({getEntryTypeName(selectedEntry.entryType)})
              </span>
            </div>
            <button
              onClick={handleRemoveReference}
              className="text-slate-500 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {content.note && (
            <p className="mt-1 text-xs text-slate-500 italic">Nota: {content.note}</p>
          )}
        </div>
      ) : content.entryId ? (
        <div className="relative rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">ID: {content.entryId}</span>
            <button
              onClick={handleRemoveReference}
              className="text-slate-500 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Search Button / Modal */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full rounded-lg border border-dashed border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm text-slate-400 hover:border-violet-500/50 hover:text-violet-300 transition-colors"
        >
          {selectedEntry ? 'Cambiar entrada...' : 'Seleccionar entrada...'}
        </button>
      ) : (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/95 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar entrada..."
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder-slate-500"
              autoFocus
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredEntries.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No se encontraron entradas</p>
            ) : (
              filteredEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry)}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-800 transition-colors"
                >
                  <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 truncate">{entry.name}</p>
                    <p className="text-xs text-slate-500">{getEntryTypeName(entry.entryType)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Note field */}
      <input
        type="text"
        value={content.note || ''}
        onChange={(e) => onUpdate({ ...content, note: e.target.value })}
        placeholder="Añadir nota (opcional)"
        className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
      />

      {/* Display Mode */}
      <div className="flex gap-2">
        {(['card', 'inline', 'badge'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onUpdate({ ...content, displayMode: mode })}
            className={`px-3 py-1 rounded text-xs ${
              content.displayMode === mode
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EntryReferenceBlock;
