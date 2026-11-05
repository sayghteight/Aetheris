import React from 'react';
import { useI18n } from '../../../../i18n';
import type { UniverseBlock, BlockContent } from '../../types';

interface QuoteBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const QuoteBlock: React.FC<QuoteBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as { type: 'quote'; text: string; attribution?: string; source?: string };

  if (!isEditing) {
    return (
      <blockquote className="border-l-2 border-violet-500/50 pl-4 italic text-slate-400">
        <p>{content.text || t('ui.noText')}</p>
        {content.attribution && (
          <footer className="mt-2 text-xs text-slate-500">
            — {content.attribution}
            {content.source && <span className="text-slate-600"> ({content.source})</span>}
          </footer>
        )}
      </blockquote>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={content.text}
        onChange={(e) => onUpdate({ ...content, text: e.target.value })}
        placeholder={t('editor.quote') + '...'}
        className="w-full resize-none rounded border border-slate-700/50 bg-slate-800/30 px-3 py-2 text-sm italic text-slate-300 outline-none focus:border-violet-500/50"
        rows={3}
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={content.attribution || ''}
          onChange={(e) => onUpdate({ ...content, attribution: e.target.value })}
          placeholder={t('universe.blocks.attribution') + '...'}
          className="flex-1 rounded border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 text-xs text-slate-400 outline-none focus:border-violet-500/50"
        />
        <input
          type="text"
          value={content.source || ''}
          onChange={(e) => onUpdate({ ...content, source: e.target.value })}
          placeholder={t('universe.blocks.source')}
          className="flex-1 rounded border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 text-xs text-slate-400 outline-none focus:border-violet-500/50"
        />
      </div>
    </div>
  );
};

export default QuoteBlock;
