import React, { useState, useEffect } from 'react';
import { Images, Upload, Loader2 } from 'lucide-react';
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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set());

  // Preload assets when assetIds change
  useEffect(() => {
    const loadAssets = async () => {
      for (const assetId of content.assetIds) {
        if (!imageUrls.has(assetId) && !loadingAssets.has(assetId)) {
          loadingAssets.add(assetId);
          setLoadingAssets(new Set(loadingAssets));

          try {
            const asset = await invoke<ProjectAsset | null>('get_asset', { id: assetId });
            if (asset && asset.data) {
              const uint8Array = new Uint8Array(asset.data);
              const blob = new Blob([uint8Array], { type: asset.mime_type });
              const url = URL.createObjectURL(blob);
              setImageUrls(prev => new Map(prev).set(assetId, url));
            }
          } catch (e) {
            console.error('Error loading asset:', assetId, e);
          } finally {
            loadingAssets.delete(assetId);
            setLoadingAssets(new Set(loadingAssets));
          }
        }
      }
    };

    loadAssets();
  }, [content.assetIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async () => {
    try {
      setIsUploading(true);
      setUploadProgress('Seleccionando archivo...');

      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Imágenes',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
        }]
      });

      if (!selected) {
        setIsUploading(false);
        return;
      }

      const files = Array.isArray(selected) ? selected : [selected];
      const newAssetIds: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        setUploadProgress(`Subiendo ${i + 1}/${files.length}...`);

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

        // Immediately create URL for the newly uploaded asset
        const uint8Array = new Uint8Array(fileData);
        const blob = new Blob([uint8Array], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setImageUrls(prev => new Map(prev).set(asset.id, url));

        newAssetIds.push(asset.id);
      }

      onUpdate({ ...content, assetIds: [...content.assetIds, ...newAssetIds] });
      setUploadProgress('');
    } catch (e) {
      console.error('Error uploading file:', e);
      setUploadProgress('Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    onUpdate({ ...content, assetIds: content.assetIds.filter((_, i) => i !== idx) });
  };

  const getImageSrc = (assetId: string) => {
    return imageUrls.get(assetId) || '';
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

    const isLoading = content.assetIds.some(id => !imageUrls.has(id) && !id.startsWith('/'));

    if (isLoading) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
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
                src={getImageSrc(id)}
                alt={content.caption || `Imagen ${idx + 1}`}
                className="h-32 w-auto rounded-lg shrink-0 object-cover"
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
              src={getImageSrc(id)}
              alt={content.caption || `Imagen ${idx + 1}`}
              className="rounded-lg w-full"
            />
          ))}
        </div>
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
        <Images className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">Galería ({content.assetIds.length} imágenes)</span>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-4 gap-2">
        {content.assetIds.map((id, idx) => (
          <div key={idx} className="relative group">
            {imageUrls.has(id) ? (
              <img
                src={getImageSrc(id)}
                alt={`Imagen ${idx + 1}`}
                className="h-16 w-full rounded object-cover"
              />
            ) : (
              <div className="h-16 w-full rounded bg-slate-800 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            )}
            <button
              onClick={() => removeImage(idx)}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400"
            >
              ×
            </button>
          </div>
        ))}

        {/* Upload button */}
        <button
          onClick={handleFileUpload}
          disabled={isUploading}
          className="flex h-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-700/50 text-slate-500 hover:border-violet-500/50 hover:text-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Upload progress */}
      {isUploading && uploadProgress && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          {uploadProgress}
        </div>
      )}

      {/* Caption */}
      <input
        type="text"
        value={content.caption || ''}
        onChange={(e) => onUpdate({ ...content, caption: e.target.value })}
        placeholder="Pie de galería (opcional)"
        className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
      />

      {/* Layout selector */}
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
