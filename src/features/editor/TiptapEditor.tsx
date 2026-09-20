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
  User,
  Search,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useCenteredWriting } from '../../hooks/useCenteredWriting';
import { CharacterMention } from './extensions/CharacterMention';
import { MentionTooltip } from './extensions/MentionTooltip';

interface UniverseCategory {
  id: string;
  name: string;
  entries: UniverseEntry[];
}

interface UniverseEntry {
  id: string;
  name: string;
  type: 'folder' | 'entry';
  entryType?: string;
  briefDescription?: string | null;
}

interface MentionEntity {
  id: string;
  name: string;
  characterType?: string;
  briefDescription?: string | null;
  categoryName?: string;
}

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  onStatsUpdate?: (words: number, readTime: number) => void;
  onSelectionChange?: (selection: { from: number; to: number } | null) => void;
  onOpenInWorldbuilding?: (entityId: string) => void;
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
  onOpenInWorldbuilding,
}) => {
  const { settings } = useSettingsStore();
  const [wordCount, setWordCount] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tooltip state for character mentions
  const [hoveredMention, setHoveredMention] = useState<MentionEntity | null>(null);
  const [mentionRect, setMentionRect] = useState<DOMRect | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  // Mention insertion panel state
  const [showMentionPanel, setShowMentionPanel] = useState(false);
  const [mentionEntities, setMentionEntities] = useState<MentionEntity[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionLoading, setMentionLoading] = useState(false);
  const mentionPanelRef = useRef<HTMLDivElement>(null);
  const mentionInputRef = useRef<HTMLInputElement>(null);

  // Load universe entities for mention panel
  const loadMentionEntities = useCallback(async () => {
    setMentionLoading(true);
    try {
      const data = await invoke<UniverseCategory[]>('get_universe_data');
      const entities: MentionEntity[] = [];
      data.forEach((cat: UniverseCategory) => {
        cat.entries.forEach((entry: UniverseEntry) => {
          if (entry.type === 'entry') {
            entities.push({
              id: entry.id,
              name: entry.name,
              characterType: entry.entryType || 'character',
              briefDescription: entry.briefDescription,
              categoryName: cat.name,
            });
          }
        });
      });
      setMentionEntities(entities);
    } catch (err) {
      console.error('Error loading entities for mentions:', err);
    } finally {
      setMentionLoading(false);
    }
  }, []);

  const handleShowMentionPanel = useCallback(() => {
    loadMentionEntities();
    setShowMentionPanel(true);
    setMentionSearch('');
    setTimeout(() => mentionInputRef.current?.focus(), 50);
  }, [loadMentionEntities]);

  const handleInsertMention = useCallback((entity: MentionEntity) => {
    editor?.chain().focus().insertContent([
      {
        type: 'characterMention',
        attrs: {
          id: entity.id,
          name: entity.name,
          characterType: entity.characterType,
          briefDescription: entity.briefDescription,
          categoryName: entity.categoryName,
        },
      },
      { type: 'text', text: ' ' },
    ]).run();
    setShowMentionPanel(false);
  }, []);

  // Filter entities based on search
  const filteredEntities = mentionEntities.filter(e =>
    e.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

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
      CharacterMention,
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

  // Handle mention hover/leave events for tooltip
  useEffect(() => {
    const handleMentionHover = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity: MentionEntity; rect: DOMRect }>;
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      setHoveredMention(customEvent.detail.entity);
      setMentionRect(customEvent.detail.rect);
    };

    const handleMentionLeave = () => {
      tooltipTimeoutRef.current = window.setTimeout(() => {
        setHoveredMention(null);
        setMentionRect(null);
      }, 150);
    };

    const handleMentionClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ entity: MentionEntity }>;
      console.log('[TiptapEditor] Mention clicked:', customEvent.detail.entity);
      // Could trigger navigation or other actions here
    };

    window.addEventListener('mention-hover', handleMentionHover);
    window.addEventListener('mention-leave', handleMentionLeave);
    window.addEventListener('mention-click', handleMentionClick);

    return () => {
      window.removeEventListener('mention-hover', handleMentionHover);
      window.removeEventListener('mention-leave', handleMentionLeave);
      window.removeEventListener('mention-click', handleMentionClick);
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

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

        {/* Mention Insert Button */}
        <ToolbarButton
          onClick={handleShowMentionPanel}
          title="Insertar mención de personaje"
        >
          <User className="w-4 h-4" />
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

      {/* Mention Tooltip */}
      {hoveredMention && mentionRect && (
        <MentionTooltip
          entity={hoveredMention}
          anchorRect={mentionRect}
          onOpenInWorldbuilding={onOpenInWorldbuilding || (() => {})}
        />
      )}

      {/* Mention Insertion Panel */}
      {showMentionPanel && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            ref={mentionPanelRef}
            className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-[400px] max-h-[500px] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-violet-400" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Insertar mención</h3>
              </div>
              <button
                onClick={() => setShowMentionPanel(false)}
                className="p-1 hover:bg-[var(--color-bg-hover)] rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  ref={mentionInputRef}
                  type="text"
                  value={mentionSearch}
                  onChange={e => setMentionSearch(e.target.value)}
                  placeholder="Buscar personajes..."
                  className="w-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Entity List */}
            <div className="flex-1 overflow-y-auto p-2">
              {mentionLoading ? (
                <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)]">
                  <div className="animate-spin w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full mr-2" />
                  Cargando...
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                  No se encontraron entidades
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredEntities.map(entity => (
                    <button
                      key={entity.id}
                      onClick={() => handleInsertMention(entity)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {entity.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{entity.name}</span>
                          <span className="text-xs text-[var(--color-text-muted)] capitalize">
                            {entity.categoryName || entity.characterType}
                          </span>
                        </div>
                        {entity.briefDescription && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                            {entity.briefDescription}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] text-center">
              Haz clic en un personaje para insertar la mención
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiptapEditor;
