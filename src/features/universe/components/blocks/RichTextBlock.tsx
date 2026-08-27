import React from 'react';
import type { UniverseBlock, BlockContent } from '../../types';

interface RichTextBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const RichTextBlock: React.FC<RichTextBlockProps> = ({ block, onUpdate, isEditing }) => {
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
        dangerouslySetInnerHTML={{ __html: content.html || '<p class="text-slate-500">Sin contenido</p>' }}
      />
    );
  }

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      className="min-h-[60px] text-sm leading-relaxed text-slate-300 outline-none"
      data-placeholder="Escribe aquí..."
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
};

export default RichTextBlock;
