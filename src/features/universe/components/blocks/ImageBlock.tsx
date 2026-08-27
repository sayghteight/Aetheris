import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { UniverseBlock, BlockContent } from '../../types';

interface ImageBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ block, onUpdate, isEditing }) => {
  const content = block.content as {
    type: 'image';
    assetId: string;
    caption?: string;
    alt?: string;
    size?: 'small' | 'medium' | 'large';
  };

  const sizeStyles = {
    small: 'max-h-48',
    medium: 'max-h-64',
    large: 'max-h-96',
  };

  if (!isEditing) {
    if (!content.assetId) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <ImageIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Sin imagen</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <img
          src={`/api/assets/${content.assetId}`}
          alt={content.alt || ''}
          className={`mx-auto rounded-lg ${sizeStyles[content.size || 'medium']}`}
        />
        {content.caption && (
          <p className="text-center text-xs text-slate-500">{content.caption}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">Bloque de imagen</span>
      </div>
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 text-center">
        <p className="text-sm text-slate-500">
          {content.assetId ? `Imagen: ${content.assetId}` : 'Arrastra una imagen o pega un asset ID'}
        </p>
      </div>
      <input
        type="text"
        value={content.caption || ''}
        onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
        placeholder="Pie de foto (opcional)"
        className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
      />
      <div className="flex gap-2">
        {(['small', 'medium', 'large'] as const).map((size) => (
          <button
            key={size}
            onClick={() => onUpdate({ ...content, size })}
            className={`px-3 py-1 rounded text-xs ${
              content.size === size
                ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600'
            }`}
          >
            {size.charAt(0).toUpperCase() + size.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ImageBlock;
