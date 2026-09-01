import React from 'react';
import { Link } from 'lucide-react';
import type { UniverseBlock, BlockContent } from '../../types';
import { useI18n } from '../../../../i18n';

interface RelatedLinksBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const RelatedLinksBlock: React.FC<RelatedLinksBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as {
    type: 'related-links';
    links: Array<{ entryId?: string; url?: string; label: string }>;
  };

  if (!isEditing) {
    if (content.links.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <Link className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('universe.blocks.noLinks')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {content.links.map((link, idx) => (
          <a
            key={idx}
            href={link.url || (link.entryId ? `/universe/${link.entryId}` : '#')}
            className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-sm text-slate-300 hover:border-violet-500/50 hover:text-violet-300 transition-colors"
          >
            <Link className="h-4 w-4 text-slate-500" />
            <span>{link.label}</span>
          </a>
        ))}
      </div>
    );
  }

  const addLink = () => {
    onUpdate({
      ...content,
      links: [...content.links, { label: '', url: '', entryId: '' }],
    });
  };

  const updateLink = (idx: number, updates: Partial<{ label: string; url: string; entryId: string }>) => {
    const newLinks = [...content.links];
    newLinks[idx] = { ...newLinks[idx], ...updates };
    onUpdate({ ...content, links: newLinks });
  };

  const removeLink = (idx: number) => {
    onUpdate({ ...content, links: content.links.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link className="h-5 w-5 text-slate-500" />
        <span className="text-sm text-slate-400">{t('universe.blocks.relatedLinks')}</span>
      </div>
      <div className="space-y-2">
        {content.links.map((link, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={link.label}
              onChange={(e) => updateLink(idx, { label: e.target.value })}
              placeholder="Título del enlace"
              className="flex-1 rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 outline-none focus:border-violet-500/50"
            />
            <input
              type="text"
              value={link.url || ''}
              onChange={(e) => updateLink(idx, { url: e.target.value, entryId: '' })}
              placeholder="URL externa"
              className="w-40 rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => removeLink(idx)}
              className="text-slate-600 hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addLink}
        className="text-xs text-violet-400 hover:text-violet-300"
      >
        + Añadir enlace
      </button>
    </div>
  );
};

export default RelatedLinksBlock;
