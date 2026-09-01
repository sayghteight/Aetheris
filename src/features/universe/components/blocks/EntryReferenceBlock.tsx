import React, { useState, useMemo } from 'react';
import { FileText, Search, X, BookOpen } from 'lucide-react';
import type { UniverseBlock, BlockContent, UniverseEntry } from '../../types';
import { useUniverseStore } from '../../store/universeStore';
import { useManuscriptStore, ManuscriptNode } from '../../../../store/manuscriptStore';
import { useI18n } from '../../../../i18n';

interface EntryReferenceBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

type ReferenceType = 'entry' | 'chapter';

export const EntryReferenceBlock: React.FC<EntryReferenceBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as {
    type: 'entry-reference';
    referenceType?: ReferenceType;
    referenceId: string;
    displayMode: 'card' | 'inline' | 'badge';
    note?: string;
  };

  const { entries, entryTypes } = useUniverseStore();
  const { nodes: manuscriptNodes } = useManuscriptStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchTab, setSearchTab] = useState<ReferenceType>(content.referenceType || 'entry');
  const [searchQuery, setSearchQuery] = useState('');

  const referenceType = content.referenceType || 'entry';
  const referenceId = content.referenceId;

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === referenceId && referenceType === 'entry'),
    [entries, referenceId, referenceType]
  );

  const selectedChapter = useMemo(
    () => manuscriptNodes.find((n) => n.id === referenceId && referenceType === 'chapter'),
    [manuscriptNodes, referenceId, referenceType]
  );

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 10);
  }, [entries, searchQuery]);

  const filteredChapters = useMemo(() => {
    const chaptersAndScenes = manuscriptNodes.filter((n) => n.type === 'chapter' || n.type === 'scene');
    if (!searchQuery.trim()) return chaptersAndScenes.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return chaptersAndScenes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 10);
  }, [manuscriptNodes, searchQuery]);

  const getEntryTypeName = (entryTypeId: string) => {
    return entryTypes.find((t) => t.id === entryTypeId)?.nameEs || entryTypeId;
  };

  const handleSelectEntry = (entry: UniverseEntry) => {
    onUpdate({
      ...content,
      referenceType: 'entry',
      referenceId: entry.id,
      displayMode: content.displayMode || 'card',
    });
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleSelectChapter = (node: ManuscriptNode) => {
    onUpdate({
      ...content,
      referenceType: 'chapter',
      referenceId: node.id,
      displayMode: content.displayMode || 'card',
    });
    setShowSearch(false);
    setSearchQuery('');
  };

  const handleRemoveReference = () => {
    onUpdate({
      type: 'entry-reference',
      referenceType: 'entry',
      referenceId: '',
      displayMode: content.displayMode || 'card',
      note: '',
    });
  };

  if (!isEditing) {
    if (!referenceId) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('universe.blocks.noReference')}</p>
          </div>
        </div>
      );
    }

    const isChapter = referenceType === 'chapter';
    const displayName = isChapter
      ? selectedChapter?.title || referenceId
      : selectedEntry?.name || referenceId;
    const displaySubtype = isChapter
      ? (selectedChapter?.type === 'chapter' ? 'Capítulo' : 'Escena')
      : (selectedEntry ? getEntryTypeName(selectedEntry.entryType) : '');

    const Icon = isChapter ? BookOpen : FileText;
    const color = isChapter ? '#f59e0b' : '#8b5cf6';

    if (content.displayMode === 'badge') {
      return (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border"
            style={{ backgroundColor: `${color}20`, color, borderColor: `${color}50` }}
          >
            <Icon className="h-3 w-3" />
            {displayName}
          </span>
          {displaySubtype && <span className="text-xs text-slate-500">({displaySubtype})</span>}
          {content.note && <span className="text-xs text-slate-600 italic">- {content.note}</span>}
        </div>
      );
    }

    if (content.displayMode === 'inline') {
      return (
        <div className="flex items-center gap-2">
          <span
            className="cursor-pointer underline"
            style={{ color }}
          >
            → {displayName}
          </span>
          {displaySubtype && <span className="text-xs text-slate-500">({displaySubtype})</span>}
          {content.note && <span className="text-xs text-slate-600 italic">- {content.note}</span>}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
          <div>
            <span className="text-sm" style={{ color }}>{displayName}</span>
            {displaySubtype && <span className="ml-2 text-xs text-slate-500">({displaySubtype})</span>}
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
        <span className="text-sm text-slate-400">{t('universe.blocks.entryReference')}</span>
      </div>

      {/* Selected Reference Display */}
      {referenceId && selectedEntry && referenceType === 'entry' && (
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
      )}

      {referenceId && selectedChapter && referenceType === 'chapter' && (
        <div className="relative rounded-lg border border-amber-500/30 bg-amber-600/10 p-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-amber-200">{selectedChapter.title}</span>
              <span className="ml-2 text-xs text-slate-500">
                ({selectedChapter.type === 'chapter' ? 'Capítulo' : 'Escena'})
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
      )}

      {referenceId && !selectedEntry && !selectedChapter && (
        <div className="relative rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">ID: {referenceId}</span>
            <button
              onClick={handleRemoveReference}
              className="text-slate-500 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search Button / Modal */}
      {!showSearch ? (
        <button
          onClick={() => {
            setShowSearch(true);
            setSearchTab(referenceType);
          }}
          className="w-full rounded-lg border border-dashed border-slate-700/50 bg-slate-800/30 px-4 py-3 text-sm text-slate-400 hover:border-violet-500/50 hover:text-violet-300 transition-colors"
        >
          {referenceId ? 'Cambiar referencia...' : 'Seleccionar referencia...'}
        </button>
      ) : (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/95 p-3 space-y-2">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-700/50">
            <button
              onClick={() => setSearchTab('entry')}
              className={`flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px transition-colors ${
                searchTab === 'entry'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <FileText className="h-3 w-3" />
              Entradas
            </button>
            <button
              onClick={() => setSearchTab('chapter')}
              className={`flex items-center gap-2 px-3 py-2 text-xs border-b-2 -mb-px transition-colors ${
                searchTab === 'chapter'
                  ? 'border-amber-500 text-amber-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <BookOpen className="h-3 w-3" />
              Capítulos/Escenas
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchTab === 'entry' ? 'Buscar entrada...' : 'Buscar capítulo o escena...'}
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

          {/* Results */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {searchTab === 'entry' && filteredEntries.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">{t('universe.blocks.noEntriesFound')}</p>
            )}
            {searchTab === 'entry' && filteredEntries.map((entry) => (
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
            ))}

            {searchTab === 'chapter' && filteredChapters.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">No se encontraron capítulos o escenas</p>
            )}
            {searchTab === 'chapter' && filteredChapters.map((node) => (
              <button
                key={node.id}
                onClick={() => handleSelectChapter(node)}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-800 transition-colors"
              >
                <BookOpen className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 truncate">{node.title}</p>
                  <p className="text-xs text-slate-500">
                    {node.type === 'chapter' ? 'Capítulo' : 'Escena'}
                  </p>
                </div>
              </button>
            ))}
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
