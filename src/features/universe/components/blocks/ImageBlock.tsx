import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { UniverseBlock, BlockContent } from '../../types';

interface ProjectAsset {
  id: string;
  filename: string;
  mime_type: string;
  data: number[];
  created_at: string;
}

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

  const [isUploading, setIsUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sizeStyles = {
    small: 'max-h-48',
    medium: 'max-h-64',
    large: 'max-h-96',
  };

  // Load image when assetId changes
  useEffect(() => {
    if (content.assetId) {
      loadImage(content.assetId);
    } else {
      setImageUrl(null);
    }
  }, [content.assetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadImage = async (assetId: string) => {
    setIsLoading(true);
    try {
      const asset = await invoke<ProjectAsset | null>('get_asset', { id: assetId });
      if (asset && asset.data) {
        const uint8Array = new Uint8Array(asset.data);
        const blob = new Blob([uint8Array], { type: asset.mime_type });
        const url = URL.createObjectURL(blob);
        setImageUrl(url);
      } else {
        setImageUrl(null);
      }
    } catch (e) {
      console.error('Error loading image:', e);
      setImageUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async () => {
    try {
      setIsUploading(true);

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Imágenes',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
        }]
      });

      if (!selected) {
        setIsUploading(false);
        return;
      }

      const filePath = Array.isArray(selected) ? selected[0] : selected;

      const { readFile } = await import('@tauri-apps/plugin-fs');
      const fileData = await readFile(filePath);

      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const mimeTypes: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      const filename = filePath.split(/[\\/]/).pop() || 'image';

      const asset = await invoke<ProjectAsset>('upload_asset', {
        filename,
        mimeType,
        data: Array.from(fileData)
      });

      // Create URL immediately for preview
      const uint8Array = new Uint8Array(fileData);
      const blob = new Blob([uint8Array], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setImageUrl(url);

      onUpdate({ ...content, assetId: asset.id });
    } catch (e) {
      console.error('Error uploading file:', e);
    } finally {
      setIsUploading(false);
    }
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

    if (isLoading) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <img
          src={imageUrl || ''}
          alt={content.alt || content.caption || ''}
          className={`mx-auto rounded-lg ${sizeStyles[content.size || 'medium']}`}
        />
        {content.caption && (
          <p className="text-center text-xs text-slate-500">{content.caption}</p>
        )}
      </div>
    );
  }

  // Editing mode
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">Bloque de imagen</span>
      </div>

      {/* Image preview / upload area */}
      <div className="relative">
        {content.assetId ? (
          <div className="relative group">
            {isLoading ? (
              <div className={`mx-auto rounded-lg bg-slate-800 flex items-center justify-center ${sizeStyles[content.size || 'medium']}`}>
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : (
              <img
                src={imageUrl || ''}
                alt=""
                className={`mx-auto rounded-lg ${sizeStyles[content.size || 'medium']} object-contain`}
              />
            )}
            <button
              onClick={() => {
                onUpdate({ ...content, assetId: '' });
                setImageUrl(null);
              }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleFileUpload}
            disabled={isUploading}
            className="w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-700/50 bg-slate-800/30 py-8 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 mb-2 animate-spin" />
                <span className="text-sm">Subiendo...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-sm">Click para subir imagen</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Caption */}
      <input
        type="text"
        value={content.caption || ''}
        onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
        placeholder="Pie de foto (opcional)"
        className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
      />

      {/* Size selector */}
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
