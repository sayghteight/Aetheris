import React from 'react';
import type { UniverseBlock, BlockContent } from '../../types';
import { useI18n } from '../../../../i18n';

interface RichTextBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const RichTextBlock: React.FC<RichTextBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as { type: 'rich-text'; html: string };

  const handleInput: React.ReactEventHandler<HTMLDivElement> = (e) => {
    onUpdate({
      type: 'rich-text',
      html: e.currentTarget.innerHTML,
    });
  };

  if (!isEditing) {
    return (
      <div
        className="prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content.html || `<p class="text-slate-500">${t('universe.blocks.noContent')}</p>` }}
      />
    );
  }

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      className="min-h-[60px] text-sm leading-relaxed text-slate-300 outline-none"
      data-placeholder={t('editor.dialogue')}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
};

export default RichTextBlock;
