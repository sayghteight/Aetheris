import React, { useEffect, useRef, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { FindReplaceDialog } from '../../components/FindReplaceDialog';
import { marked } from 'marked';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code2,
  Sparkles,
  MessageCircle,
  Eye,
  EyeOff,
  SpellCheck,
} from 'lucide-react';

interface LexicalEditorProps {
  sceneId: string;
  onStatsUpdate: (words: number, readTime: number) => void;
}

interface LexicalEditorState {
  wrap: (before: string, after?: string) => void;
  prefixLines: (prefix: string) => void;
  insert: (value: string) => void;
}

const FORMAT_BUTTONS: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; action: (editor: LexicalEditorState) => void }> = [
  { label: 'Negrita', icon: Bold, action: (editor) => editor.wrap('**') },
  { label: 'Cursiva', icon: Italic, action: (editor) => editor.wrap('*') },
  { label: 'Subrayado', icon: Underline, action: (editor) => editor.wrap('<u>', '</u>') },
  { label: 'Tachado', icon: Strikethrough, action: (editor) => editor.wrap('~~') },
];

const BLOCK_BUTTONS: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; action: (editor: LexicalEditorState) => void }> = [
  { icon: Heading1, label: 'Título 1', action: (editor) => editor.prefixLines('# ') },
  { icon: Heading2, label: 'Título 2', action: (editor) => editor.prefixLines('## ') },
  { icon: List, label: 'Lista', action: (editor) => editor.prefixLines('- ') },
  { icon: ListOrdered, label: 'Numerada', action: (editor) => editor.prefixLines('1. ') },
  { icon: Quote, label: 'Cita', action: (editor) => editor.prefixLines('> ') },
  { icon: Code2, label: 'Código', action: (editor) => editor.wrap('```\n', '\n```') },
];

// For cycleBlockType - order matters
const BLOCK_TYPES_PRECEDENCE = ['', '# ', '## ', '- ', '> ', '```\n'];

const WRITER_BUTTONS: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; action: (editor: LexicalEditorState) => void }> = [
  { label: 'Diálogo', icon: MessageCircle, action: (editor) => editor.wrap('"', '"') },
  { label: 'Escena', icon: Sparkles, action: (editor) => editor.insert('\n\n---\n\n') },
];

const LexicalEditor: React.FC<LexicalEditorProps> = ({ sceneId, onStatsUpdate }) => {
  const { settings } = useSettingsStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimeout = useRef<number | null>(null as any);
  const lastStats = useRef({ words: 0, readTime: 0 });

  // Action refs for keyboard shortcuts (no-arg wrappers)
  const boldActionRef = useRef<() => void>(() => {});
  const italicActionRef = useRef<() => void>(() => {});
  const underlineActionRef = useRef<() => void>(() => {});
  const strikethroughActionRef = useRef<() => void>(() => {});

  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  const scheduleSave = useCallback((newText: string) => {
    setText(newText);
    updateStats(newText);
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(() => saveContent(newText), 700);
  }, []);

  const saveContent = async (newText: string) => {
    setSaveStatus('saving');
    try {
      await invoke('update_scene_content', { nodeId: sceneId, content: newText, plainText: newText });
      setSaveStatus('saved');
      setLastSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Auto-save failed', err);
      setSaveStatus('error');
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const content = await invoke<string | null>('get_scene_content', { nodeId: sceneId });
        if (!mounted) return;
        setText(content ?? '');
      } catch (err) {
        console.error('Error loading scene:', err);
      }
    })();
    return () => { mounted = false; };
  }, [sceneId]);

  const computeStats = (value: string) => {
    const words = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;
    const readTime = Math.ceil(words / 200);
    return { words, readTime };
  };

  const updateStats = (value: string) => {
    const { words, readTime } = computeStats(value);
    if (lastStats.current.words !== words || lastStats.current.readTime !== readTime) {
      lastStats.current = { words, readTime };
      onStatsUpdate(words, readTime);
    }
  };

  const getTextAreaState = (): { start: number; end: number; value: string } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? 0,
      value: ta.value,
    };
  };

  const restoreSelection = (start: number, end: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.setSelectionRange(start, end);
    ta.focus();
  };

  const wrapSelection = useCallback((before: string, after?: string) => {
    const state = getTextAreaState();
    if (!state) return;
    const { start, end, value } = state;
    const selected = value.slice(start, end);
    const wrapped = before + selected + (after ?? before);
    const newText = value.slice(0, start) + wrapped + value.slice(end);
    setText(newText);
    const newStart = start + before.length;
    const newEnd = newStart + selected.length;
    restoreSelection(newStart, newEnd);
    scheduleSave(newText);
  }, [scheduleSave]);

  const prefixLines = useCallback((prefix: string) => {
    const state = getTextAreaState();
    if (!state) return;
    const { start, end, value } = state;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end) === -1 ? value.length : end + value.slice(end).indexOf('\n');
    const targetText = value.slice(lineStart, lineEnd);
    const transformed = targetText.split('\n').map((line) => {
      const trimmed = line.trimStart();
      return trimmed === '' ? line : prefix + trimmed;
    }).join('\n');
    const newText = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
    setText(newText);
    const adjustedLines = targetText.split('\n').filter((line) => line.trim() !== '').length;
    const newStart = start + prefix.length;
    const newEnd = end + prefix.length * adjustedLines;
    restoreSelection(newStart, newEnd);
    scheduleSave(newText);
  }, [scheduleSave]);

  const insertSnippet = useCallback((snippet: string) => {
    const state = getTextAreaState();
    if (!state) return;
    const { start, end, value } = state;
    const newText = value.slice(0, start) + snippet + value.slice(end);
    setText(newText);
    const newCursor = start + snippet.length;
    restoreSelection(newCursor, newCursor);
    scheduleSave(newText);
  }, [scheduleSave]);

  const cycleBlockType = useCallback(() => {
    const nextIndex = (currentBlockIndex + 1) % BLOCK_TYPES_PRECEDENCE.length;
    setCurrentBlockIndex(nextIndex);
    boldActionRef.current();
  }, [currentBlockIndex]);

  // Keep action refs updated for keyboard shortcuts
  boldActionRef.current = () => wrapSelection('**');
  italicActionRef.current = () => wrapSelection('*');
  underlineActionRef.current = () => wrapSelection('<u>', '</u>');
  strikethroughActionRef.current = () => wrapSelection('~~');

  // Find next occurrence and scroll to it
  const findNext = useCallback((query: string) => {
    const ta = textareaRef.current;
    if (!ta || !query.trim()) return;

    const currentPos = ta.selectionEnd;
    const text = ta.value;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let matchIndex = lowerText.indexOf(lowerQuery, currentPos);
    if (matchIndex === -1) {
      matchIndex = lowerText.indexOf(lowerQuery, 0);
    }

    if (matchIndex !== -1) {
      ta.setSelectionRange(matchIndex, matchIndex + query.length);
      ta.focus();
      const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 28;
      const linesBefore = text.substring(0, matchIndex).split('\n').length;
      ta.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
    }
  }, []);

  // Replace occurrences
  const replace = useCallback((query: string, replacement: string, all: boolean = false) => {
    const ta = textareaRef.current;
    if (!ta || !query.trim()) return;

    if (all) {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const newText = ta.value.replace(regex, replacement);
      setText(newText);
      scheduleSave(newText);
    } else {
      const state = getTextAreaState();
      if (!state) return;
      const { start, end, value } = state;

      const selectedText = value.slice(start, end);
      if (selectedText.toLowerCase() === query.toLowerCase()) {
        const newText = value.slice(0, start) + replacement + value.slice(end);
        setText(newText);
        scheduleSave(newText);
        restoreSelection(start + replacement.length, start + replacement.length);
      }
      findNext(query);
    }
  }, [scheduleSave, findNext]);

  const editorState: LexicalEditorState = {
    wrap: wrapSelection,
    prefixLines,
    insert: insertSnippet,
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onBold: () => boldActionRef.current(),
    onItalic: () => italicActionRef.current(),
    onUnderline: () => underlineActionRef.current(),
    onStrikethrough: () => strikethroughActionRef.current(),
    onFind: () => setShowFindReplace(true),
    onReplace: () => setShowFindReplace(true),
    onFormatBlock: () => cycleBlockType(),
  });

  const renderPreview = () => {
    const html = marked.parse(text);
    return { __html: html };
  };

  const fontFamily = settings.theme === 'noir' ? 'Georgia, serif' : 'Inter, ui-sans-serif, system-ui, sans-serif';

  const saveLabel = saveStatus === 'saving'
    ? 'Guardando…'
    : saveStatus === 'saved'
      ? `Guardado ${lastSavedAt ?? ''}`
      : saveStatus === 'error'
        ? 'Error al guardar'
        : 'Sin cambios';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/40 border border-slate-900 rounded-3xl overflow-hidden shadow-xl shadow-slate-950/20">
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FORMAT_BUTTONS.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => action(editorState)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900 transition-colors"
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {BLOCK_BUTTONS.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => action(editorState)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900 transition-colors"
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
          {WRITER_BUTTONS.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => action(editorState)}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900 transition-colors"
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}

          {settings.spellCheck && (
            <button
              type="button"
              onClick={() => setShowSpellCheck(!showSpellCheck)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                showSpellCheck
                  ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
              title={showSpellCheck ? 'Desactivar revisión' : 'Activar revisión ortográfica'}
            >
              <SpellCheck className="w-4 h-4" />
              <span>{showSpellCheck ? 'Corrector activo' : 'Revisión ortográfica'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="ml-auto flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {preview ? 'Volver al editor' : 'Vista previa'}
          </button>
        </div>

        <div className="text-xs text-slate-500">{saveLabel}</div>
      </div>

      <div className="flex-1 p-4 min-h-0">
        {!preview ? (
          <div className="relative w-full h-full">
            {showFindReplace && (
              <FindReplaceDialog
                text={text}
                initialQuery={searchQuery}
                onClose={() => {
                  setShowFindReplace(false);
                  setSearchQuery('');
                }}
                onFindNext={(query) => {
                  setSearchQuery(query);
                  findNext(query);
                }}
                onReplace={(query, replacement, all) =>
                  replace(query, replacement, all)
                }
              />
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => scheduleSave(e.target.value)}
              onKeyDown={(e) => {
                // Intercept Ctrl+F and Ctrl+H to open our find dialog instead of browser's
                if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'h' || e.key === 'H')) {
                  e.preventDefault();
                  setShowFindReplace(true);
                  return;
                }
              }}
              className="w-full h-full resize-none bg-slate-950/0 text-slate-100 placeholder-slate-500 outline-none p-4 rounded-3xl border border-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              style={{ fontFamily, fontSize: 18, lineHeight: 1.75 }}
              placeholder="Comienza a escribir tu escena aquí..."
              spellCheck={settings.spellCheck}
              lang={settings.spell_check_languages?.[0] || 'es'}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-auto prose prose-invert max-w-none rounded-3xl border border-slate-900 bg-slate-950/60 p-6" dangerouslySetInnerHTML={renderPreview()} />
        )}
      </div>
    </div>
  );
};

export default LexicalEditor;
