import React from 'react';
import { Images } from 'lucide-react';
import type { UniverseBlock, BlockContent } from '../../types';

interface GalleryBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const GalleryBlock: React.FC<GalleryBlockProps> = ({ block, onUpdate, isEditing }) => {
  const content = block.content as {
    type: 'gallery';
    assetIds: string[];
    layout: 'grid' | 'masonry' | 'carousel';
    caption?: string;
  };

  if (!isEditing) {
    if (content.assetIds.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <Images className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Sin imágenes</p>
          </div>
        </div>
      );
    }

    if (content.layout === 'carousel') {
      return (
        <div className="space-y-2">
          <div className="flex overflow-x-auto gap-2 pb-2">
            {content.assetIds.map((id, idx) => (
              <img
                key={idx}
                src={`/api/assets/${id}`}
                alt={content.caption || `Imagen ${idx + 1}`}
                className="h-32 w-auto rounded-lg shrink-0"
              />
            ))}
          </div>
          {content.caption && (
            <p className="text-center text-xs text-slate-500">{content.caption}</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className={`grid gap-2 ${content.layout === 'masonry' ? 'columns-2' : 'grid-cols-3'}`}>
          {content.assetIds.map((id, idx) => (
            <img
              key={idx}
              src={`/api/assets/${id}`}
              alt={content.caption || `Imagen ${idx + 1}`}
              className="rounded-lg"
            />
          ))}
        </div>
        {content.caption && (
          <p className="text-center text-xs text-slate-500">{content.caption}</p>
        )}
      </div>
    );
  }

  const addImage = () => {
    const newId = prompt('Ingresa el ID del asset:');
    if (newId) {
      onUpdate({ ...content, assetIds: [...content.assetIds, newId] });
    }
  };

  const removeImage = (idx: number) => {
    onUpdate({ ...content, assetIds: content.assetIds.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Images className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">Galería ({content.assetIds.length} imágenes)</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {content.assetIds.map((id, idx) => (
          <div key={idx} className="relative group">
            <img
              src={`/api/assets/${id}`}
              alt={`Imagen ${idx + 1}`}
              className="h-16 w-full rounded object-cover"
            />
            <button
              onClick={() => removeImage(idx)}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={addImage}
          className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-700/50 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors"
        >
          +
        </button>
      </div>
      <input
        type="text"
        value={content.caption || ''}
        onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
        placeholder="Pie de galería (opcional)"
        className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
      />
      <div className="flex gap-2">
        {(['grid', 'masonry', 'carousel'] as const).map((layout) => (
          <button
            key={layout}
            onClick={() => onUpdate({ ...content, layout })}
            className={`px-3 py-1 rounded text-xs ${
              content.layout === layout
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {layout.charAt(0).toUpperCase() + layout.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GalleryBlock;
