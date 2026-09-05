import React, { useRef, useEffect, useState } from 'react';
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
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [localHtml, setLocalHtml] = useState(content.html || '');
  const isUpdatingRef = useRef(false);

  // Sync local state when content changes externally (e.g., loading from DB)
  useEffect(() => {
    if (!isEditing || isUpdatingRef.current) return;
    if (editorRef.current && editorRef.current.innerHTML !== content.html) {
      editorRef.current.innerHTML = content.html || '';
      setLocalHtml(content.html || '');
    }
  }, [content.html, isEditing]);

  // Handle input from the user
  const handleInput = () => {
    if (isComposingRef.current || !editorRef.current) return;
    isUpdatingRef.current = true;
    const newHtml = editorRef.current.innerHTML;
    setLocalHtml(newHtml);
    onUpdate({
      type: 'rich-text',
      html: newHtml,
    });
    isUpdatingRef.current = false;
  };

  // Handle composition events for IME (international input)
  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    if (editorRef.current) {
      const newHtml = editorRef.current.innerHTML;
      setLocalHtml(newHtml);
      onUpdate({
        type: 'rich-text',
        html: newHtml,
      });
    }
  };

  // Focus editor when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isEditing]);

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
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      className="min-h-[60px] text-sm leading-relaxed text-slate-300 outline-none"
      data-placeholder={t('editor.dialogue')}
    />
  );
};

export default RichTextBlock;
