import React, { useState, useEffect } from 'react';
import {
  PencilLine,
  Trash2,
  Star,
  Clock,
  ArrowLeft,
  User,
  MapPin,
  Users,
  Crown,
  PawPrint,
  Gem,
  Calendar,
  Lightbulb,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useUniverseStore } from '../../store/universeStore';
import { BlockEditor } from '../editor/BlockEditor';
import type { UniverseEntry, LayoutType, EntryType, UniverseBlock } from '../../types';
import { getEntryTypeColor } from '../../types';

interface ProjectAsset {
  id: string;
  filename: string;
  mime_type: string;
  data: number[];
  created_at: string;
}

// ─── Type Icons Mapping ────────────────────────────────────────────────────────

const typeIcons: Record<EntryType, React.ComponentType<{ className?: string; color?: string }>> = {
  character: User,
  location: MapPin,
  faction: Users,
  kingdom: Crown,
  creature: PawPrint,
  item: Gem,
  event: Calendar,
  concept: Lightbulb,
  other: FileText,
};

// ─── Entry Header ──────────────────────────────────────────────────────────────

interface EntryHeaderProps {
  entry: UniverseEntry;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFeatured: () => void;
  isEditing: boolean;
}

const EntryHeader: React.FC<EntryHeaderProps> = ({
  entry,
  onBack,
  onEdit,
  onDelete,
  onToggleFeatured,
  isEditing,
}) => {
  const Icon = typeIcons[entry.entryType] || FileText;
  const color = getEntryTypeColor(entry.entryType);

  return (
    <div className="border-b border-slate-800/60 bg-slate-900/50 px-6 py-4">
      <div className="flex items-center gap-4">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Type Icon */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl border"
          style={{
            borderColor: `${color}40`,
            backgroundColor: `${color}10`,
          }}
        >
          <Icon className="h-6 w-6" color={color} />
        </div>

        {/* Title & Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white truncate">{entry.name}</h1>
            {entry.isFeatured && (
              <Star className="h-5 w-5 shrink-0 fill-amber-500 text-amber-500" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {entry.entryType}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {new Date(entry.updatedAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFeatured}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
              entry.isFeatured
                ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                : 'border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-slate-200'
            }`}
            title={entry.isFeatured ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <Star className={`h-4 w-4 ${entry.isFeatured ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
            title="Eliminar entrada"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {!isEditing && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            >
              <PencilLine className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Brief Description */}
      {entry.briefDescription && (
        <p className="mt-4 text-sm text-slate-400">{entry.briefDescription}</p>
      )}

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── UniverseEntryView ─────────────────────────────────────────────────────────

interface UniverseEntryViewProps {
  entryId: string;
  onBack: () => void;
}

export const UniverseEntryView: React.FC<UniverseEntryViewProps> = ({
  entryId,
  onBack,
}) => {
  const {
    entries,
    blocks,
    relations,
    entryTypes,
    updateEntry,
    deleteEntry,
  } = useUniverseStore();

  const entry = entries.find((e) => e.id === entryId);
  const entryBlocks = blocks.get(entryId) || [];

  const [isEditing, setIsEditing] = React.useState(false);
  const [layout, setLayout] = React.useState<LayoutType>('1-col');

  React.useEffect(() => {
    if (entry) {
      setLayout(entry.layout);
    }
  }, [entry?.id]);

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-700" />
          <p className="mt-4 text-slate-400">Entrada no encontrada</p>
          <button
            onClick={onBack}
            className="mt-4 text-sm text-violet-400 hover:text-violet-300"
          >
            Volver al índice
          </button>
        </div>
      </div>
    );
  }

  const handleEdit = () => setIsEditing(true);
  const handleBackToView = () => setIsEditing(false);

  const handleDelete = async () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${entry.name}"?`)) {
      await deleteEntry(entry.id);
      onBack();
    }
  };

  const handleToggleFeatured = async () => {
    await updateEntry(entry, entryBlocks);
  };

  const handleSave = async (updatedBlocks: typeof entryBlocks) => {
    await updateEntry(
      {
        ...entry,
        layout,
        updatedAt: new Date().toISOString(),
      },
      updatedBlocks
    );
    setIsEditing(false);
  };

  // Get related entries
  const relatedEntries = relations
    .filter((r) => r.sourceEntryId === entryId || r.targetEntryId === entryId)
    .map((r) => {
      const relatedId = r.sourceEntryId === entryId ? r.targetEntryId : r.sourceEntryId;
      return entries.find((e) => e.id === relatedId);
    })
    .filter(Boolean) as UniverseEntry[];

  return (
    <div className="flex h-full flex-col">
      <EntryHeader
        entry={entry}
        onBack={onBack}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleFeatured={handleToggleFeatured}
        isEditing={isEditing}
      />

      {/* Block Editor / Viewer */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
        {isEditing ? (
          <BlockEditor
            entryId={entryId}
            layout={layout}
            onLayoutChange={setLayout}
            isEditing={true}
          />
        ) : (
          <div className="mx-auto w-full max-w-6xl px-4 py-6">
            {/* Read Mode: Render blocks */}
            <div
              className={
                layout === '1-col'
                  ? ''
                  : layout === '2-col'
                  ? 'grid grid-cols-2 gap-6'
                  : 'grid grid-cols-3 gap-6'
              }
            >
              {[0, 1, 2].map((colIdx) => {
                const colBlocks = entryBlocks
                  .filter((b) => b.columnIndex === colIdx)
                  .sort((a, b) => a.blockOrder - b.blockOrder);

                if (colBlocks.length === 0 && layout !== '1-col') return null;

                return (
                  <div key={colIdx} className={layout === '1-col' ? '' : ''}>
                    {colBlocks.map((block) => (
                      <ReadModeBlock key={block.id} block={block} />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Related Entries */}
            {relatedEntries.length > 0 && (
              <div className="mt-8 border-t border-slate-800/60 pt-6">
                <h3 className="mb-4 text-sm font-medium text-slate-400">
                  Entradas relacionadas
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedEntries.map((related) => {
                    const Icon = typeIcons[related.entryType] || FileText;
                    const color = getEntryTypeColor(related.entryType);
                    return (
                      <div
                        key={related.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 transition hover:border-slate-700"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                          style={{
                            borderColor: `${color}40`,
                            backgroundColor: `${color}10`,
                          }}
                        >
                          <Icon className="h-4 w-4" color={color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {related.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {entryTypes.find((t) => t.id === related.entryType)?.nameEs}
                          </p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-600" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Mode Footer */}
      {isEditing && (
        <div className="flex items-center justify-between border-t border-slate-800/60 bg-slate-900/50 px-6 py-3">
          <button
            onClick={handleBackToView}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleSave(entryBlocks)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Gallery View (loads assets from DB) ───────────────────────────────────────

const GalleryView: React.FC<{ assetIds: string[]; layout: 'grid' | 'masonry' | 'carousel' }> = ({ assetIds, layout }) => {
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      setIsLoading(true);
      const newUrls = new Map<string, string>();

      for (const assetId of assetIds) {
        try {
          const asset = await invoke<ProjectAsset | null>('get_asset', { id: assetId });
          if (asset && asset.data) {
            const uint8Array = new Uint8Array(asset.data);
            const blob = new Blob([uint8Array], { type: asset.mime_type });
            newUrls.set(assetId, URL.createObjectURL(blob));
          }
        } catch (e) {
          console.error('Error loading asset:', assetId, e);
        }
      }

      setImageUrls(newUrls);
      setIsLoading(false);
    };

    loadAssets();
  }, [assetIds.join(',')]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (layout === 'carousel') {
    return (
      <div className="mb-4">
        <div className="flex overflow-x-auto gap-2 pb-2">
          {assetIds.map((id, idx) => (
            imageUrls.has(id) && (
              <img
                key={idx}
                src={imageUrls.get(id)}
                alt={`Imagen ${idx + 1}`}
                className="h-32 w-auto rounded-lg shrink-0 object-cover"
              />
            )
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 grid gap-2 ${layout === 'masonry' ? 'columns-2' : 'grid-cols-3'}`}>
      {assetIds.map((id, idx) => (
        imageUrls.has(id) && (
          <img
            key={idx}
            src={imageUrls.get(id)}
            alt={`Imagen ${idx + 1}`}
            className="rounded-lg w-full"
          />
        )
      ))}
    </div>
  );
};

// ─── Read Mode Block ───────────────────────────────────────────────────────────

const ReadModeBlock: React.FC<{ block: UniverseBlock }> = ({ block }) => {
  const content = block.content;

  switch (block.blockType) {
    case 'rich-text':
      return (
        <div
          className="prose prose-invert prose-sm max-w-none mb-4"
          dangerouslySetInnerHTML={{
            __html: (content as { type: 'rich-text'; html: string }).html || '',
          }}
        />
      );

    case 'divider':
      return (
        <div className="flex items-center justify-center py-4 mb-4">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
        </div>
      );

    case 'key-info': {
      const { fields } = content as { type: 'key-info'; fields: Array<{ label: string; value: string; icon?: string }> };
      if (!fields || fields.length === 0) return null;
      return (
        <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
          <div className="grid gap-3">
            {fields.map((field, idx) => (
              <div key={idx} className="flex items-center gap-3">
                {field.icon && <span className="text-sm">{field.icon}</span>}
                <span className="text-xs font-medium text-slate-500">{field.label}</span>
                <span className="text-sm text-slate-300">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'quote': {
      const { text, attribution, source } = content as { type: 'quote'; text: string; attribution?: string; source?: string };
      return (
        <blockquote className="mb-4 border-l-2 border-violet-500/50 pl-4 italic text-slate-400">
          <p>{text}</p>
          {attribution && (
            <footer className="mt-2 text-xs text-slate-500">
              — {attribution}
              {source && <span className="text-slate-600"> ({source})</span>}
            </footer>
          )}
        </blockquote>
      );
    }

    case 'list': {
      const { style, items } = content as { type: 'list'; style: 'bullet' | 'numbered' | 'checklist'; items: Array<{ id: string; text: string; checked?: boolean }> };
      if (!items || items.length === 0) return null;
      return (
        <ul className={`mb-4 space-y-1 ${style === 'numbered' ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
          {items.map((item) => (
            <li
              key={item.id}
              className={`text-sm ${item.checked ? 'text-slate-500 line-through' : 'text-slate-300'}`}
            >
              {item.text}
            </li>
          ))}
        </ul>
      );
    }

    case 'entry-reference': {
      const { entryId } = content as { type: 'entry-reference'; entryId: string };
      const { entries } = useUniverseStore();
      const referencedEntry = entries.find((e) => e.id === entryId);

      if (!referencedEntry) {
        return (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-center text-sm text-red-400">
            Entrada referenciada no encontrada
          </div>
        );
      }

      const Icon = typeIcons[referencedEntry.entryType] || FileText;
      const color = getEntryTypeColor(referencedEntry.entryType);

      return (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{
              borderColor: `${color}40`,
              backgroundColor: `${color}10`,
            }}
          >
            <Icon className="h-4 w-4" color={color} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-200">
              {referencedEntry.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {referencedEntry.entryType}
            </p>
          </div>
        </div>
      );
    }

    case 'gallery': {
      const { assetIds, layout } = content as { type: 'gallery'; assetIds: string[]; layout?: 'grid' | 'masonry' | 'carousel' };
      if (!assetIds || assetIds.length === 0) return null;

      return (
        <GalleryView assetIds={assetIds} layout={layout || 'grid'} />
      );
    }

    default:
      return (
        <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 text-center text-sm text-slate-500">
          Bloque tipo: {block.blockType}
        </div>
      );
  }
};

export default UniverseEntryView;
