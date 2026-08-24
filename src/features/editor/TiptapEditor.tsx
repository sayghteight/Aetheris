import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import CharacterCount from '@tiptap/extension-character-count';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Undo,
  Redo,
  MessageCircle,
} from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useCenteredWriting } from '../../hooks/useCenteredWriting';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onStatsUpdate?: (words: number, readTime: number) => void;
  onSelectionChange?: (selection: { from: number; to: number } | null) => void;
}

// Toolbar Button Component
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg transition-all ${
      isActive
        ? 'bg-[var(--color-brand)] text-white'
        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-6 bg-[var(--color-border)] mx-1" />
);

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Comienza a escribir tu escena aquí...',
  onStatsUpdate,
  onSelectionChange,
}) => {
  const { settings } = useSettingsStore();
  const [wordCount, setWordCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate stats
  const calculateStats = useCallback((text: string) => {
    const plainText = text.replace(/<[^>]+>/g, ' ').trim();
    const words = plainText === '' ? 0 : plainText.split(/\s+/).length;
    const readTime = Math.ceil(words / 200);
    return { words, readTime };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {},
        orderedList: {},
        blockquote: {},
        codeBlock: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--color-brand)] underline cursor-pointer',
        },
      }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);

      // Update stats
      const text = editor.getText();
      const { words, readTime } = calculateStats(text);
      setWordCount(words);
      onStatsUpdate?.(words, readTime);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        onSelectionChange?.({ from, to });
      } else {
        onSelectionChange?.(null);
      }
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-lg max-w-none focus:outline-none min-h-[60vh] text-[var(--color-text-primary)] leading-relaxed',
        style: `font-family: ${settings.fontFamily === 'serif' ? 'Georgia, serif' : settings.fontFamily === 'mono' ? 'monospace' : 'Inter, sans-serif'}; font-size: ${settings.fontSize || 18}px; line-height: ${settings.lineHeight || 1.75};`,
      },
    },
  });

  // Sync content from props (for loading saved content)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Word count display
  useEffect(() => {
    if (editor) {
      const { words, readTime } = calculateStats(editor.getText());
      setWordCount(words);
      onStatsUpdate?.(words, readTime);
    }
  }, [editor, calculateStats, onStatsUpdate]);

  // Centered writing mode hook
  useCenteredWriting({
    editor,
    enabled: settings.centeredWritingMode ?? false,
    targetPosition: settings.centeredWritingPosition ?? 50,
    scrollContainerRef,
  });

  // Calculate bottom padding for centered writing mode
  // This ensures the last line can reach the centered cursor position
  const centeredWritingPadding = settings.centeredWritingMode
    ? `calc(${100 - (settings.centeredWritingPosition ?? 50)}vh + 20vh)`
    : '0';

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Cargando editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-secondary)] rounded-3xl border border-[var(--color-border)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Subrayado (Ctrl+U)"
      >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Dialogue marker */}
        <ToolbarButton
          onClick={() => {
            editor.chain().focus().insertContent('— ').run();
          }}
          title="Diálogo (guión largo)"
        >
          <MessageCircle className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            editor.chain().focus().insertContent('«').run();
          }}
          title="Abrir comillas angulares"
        >
          <span className="text-sm font-semibold">«</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            editor.chain().focus().insertContent('»').run();
          }}
          title="Cerrar comillas angulares"
        >
          <span className="text-sm font-semibold">»</span>
        </ToolbarButton>

        <ToolbarButton
        onClick={() => editor.chain().focus().insertContent('…').run()}
        title="Puntos suspensivos"
        >
          <span className="text-sm font-semibold">…</span>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().insertContent('\n\n⁂\n\n').run()}
          title="Separador de escena"
        >
          <span className="text-sm font-semibold">⁂</span>
        </ToolbarButton>
        <Divider />
        
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 py-6">
        <div
          className="min-h-full"
          style={{
            paddingBottom: centeredWritingPadding,
          }}
        >
          <EditorContent editor={editor} className="min-h-full" />
        </div>
      </div>

      {/* Footer with word count */}
      <div className="flex items-center justify-end px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-muted)]">
        <span>{wordCount} palabras</span>
      </div>
    </div>
  );
};

export default TiptapEditor;
