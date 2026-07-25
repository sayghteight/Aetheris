import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';
import { marked } from 'marked';
import { useSpellCheck } from '../../hooks/useSpellCheck';
import { SpellCheckOverlay } from '../../components/SpellCheckOverlay';
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
  Loader2,
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

const FORMAT_BUTTONS = [
  { label: 'Negrita', icon: Bold, action: (editor: LexicalEditorState) => editor.wrap('**') },
  { label: 'Cursiva', icon: Italic, action: (editor: LexicalEditorState) => editor.wrap('*') },
  { label: 'Subrayado', icon: Underline, action: (editor: LexicalEditorState) => editor.wrap('<u>', '</u>') },
  { label: 'Tachado', icon: Strikethrough, action: (editor: LexicalEditorState) => editor.wrap('~~') },
];

const BLOCK_BUTTONS = [
  { icon: Heading1, action: (editor: LexicalEditorState) => editor.prefixLines('# ') },
  { icon: Heading2, action: (editor: LexicalEditorState) => editor.prefixLines('## ') },
  { label: 'Lista', icon: List, action: (editor: LexicalEditorState) => editor.prefixLines('- ') },
  { label: 'Numerada', icon: ListOrdered, action: (editor: LexicalEditorState) => editor.prefixLines('1. ') },
  { label: 'Cita', icon: Quote, action: (editor: LexicalEditorState) => editor.prefixLines('> ') },
  { label: 'Código', icon: Code2, action: (editor: LexicalEditorState) => editor.wrap('```\n', '\n```') },
];

const WRITER_BUTTONS = [
  { label: 'Diálogo', icon: MessageCircle, action: (editor: LexicalEditorState) => editor.wrap('“', '”') },
  { label: 'Escena', icon: Sparkles, action: (editor: LexicalEditorState) => editor.insert('\n\n---\n\n') },
];

const LexicalEditor: React.FC<LexicalEditorProps> = ({ sceneId, onStatsUpdate }) => {
  const { settings } = useSettingsStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimeout = useRef<number | null>(null as any);
  const spellCheckTimeout = useRef<number | null>(null as any);
  const lastStats = useRef({ words: 0, readTime: 0 });
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [spellCheckErrors, setSpellCheckErrors] = useState<Set<string>>(new Set());

  // Spell check hook
  const {
    misspelledWords,
    checkTextSync,
    getSuggestions,
    isLoading: spellCheckLoading,
    isReady: spellCheckReady,
  } = useSpellCheck();

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

  // Spell check effect - run when text changes and spell check is enabled
  useEffect(() => {
    if (!settings.spellCheck || !showSpellCheck) {
      setSpellCheckErrors(new Set());
      return;
    }

    if (spellCheckTimeout.current) {
      window.clearTimeout(spellCheckTimeout.current);
    }

    spellCheckTimeout.current = window.setTimeout(async () => {
      // Sync check for quick error detection
      const errors = checkTextSync(text);
      setSpellCheckErrors(new Set(errors.map(e => e.toLowerCase())));

      // Async check for full misspelled words with suggestions and positions
      await checkText(text);
    }, 500);

    return () => {
      if (spellCheckTimeout.current) {
        window.clearTimeout(spellCheckTimeout.current);
      }
    };
  }, [text, settings.spellCheck, showSpellCheck, spellCheckReady]);

  // Handle correction events from overlay
  useEffect(() => {
    const handleApplyCorrection = (e: CustomEvent<{ original: string; correction: string }>) => {
      const { original, correction } = e.detail;
      const newText = text.replace(new RegExp(`\\b${original}\\b`, 'g'), correction);
      setText(newText);
      scheduleSave(newText);
    };

    window.addEventListener('apply-correction', handleApplyCorrection as EventListener);
    return () => {
      window.removeEventListener('apply-correction', handleApplyCorrection as EventListener);
    };
  }, [text]);

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

  const saveContent = async (newText: string) => {
    setSaveStatus('saving');
    try {
      const plainText = newText;
      await invoke('update_scene_content', { nodeId: sceneId, content: newText, plainText });
      setSaveStatus('saved');
      setLastSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Auto-save failed', err);
      setSaveStatus('error');
    }
  };

  const scheduleSave = (newText: string) => {
    setText(newText);
    updateStats(newText);
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(() => saveContent(newText), 700);
  };

  const getTextAreaState = () => {
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

  const wrapSelection = (before: string, after?: string) => {
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
  };

  const prefixLines = (prefix: string) => {
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
  };

  const insertSnippet = (snippet: string) => {
    const state = getTextAreaState();
    if (!state) return;
    const { start, end, value } = state;
    const newText = value.slice(0, start) + snippet + value.slice(end);
    setText(newText);
    const newCursor = start + snippet.length;
    restoreSelection(newCursor, newCursor);
    scheduleSave(newText);
  };

  const editorState: LexicalEditorState = {
    wrap: wrapSelection,
    prefixLines,
    insert: insertSnippet,
  };

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

  const spellCheckLabel = spellCheckLoading
    ? 'Cargando diccionarios...'
    : showSpellCheck && spellCheckErrors.size > 0
      ? `${spellCheckErrors.size} error${spellCheckErrors.size > 1 ? 'es' : ''} ortográfico${spellCheckErrors.size > 1 ? 's' : ''}`
      : showSpellCheck
        ? 'Sin errores'
        : 'Revisión ortográfica';

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

          {/* Spell Check Toggle */}
          {settings.spellCheck && (
            <button
              type="button"
              onClick={() => setShowSpellCheck(!showSpellCheck)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                showSpellCheck
                  ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
              title="Revisión ortográfica"
            >
              {spellCheckLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SpellCheck className="w-4 h-4" />
              )}
              <span>{spellCheckLabel}</span>
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

      <div className="flex-1 p-4 min-h-0" ref={containerRef}>
        {!preview ? (
          <div className="relative w-full h-full">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => scheduleSave(e.target.value)}
              className="w-full h-full resize-none bg-slate-950/0 text-slate-100 placeholder-slate-500 outline-none p-4 rounded-3xl border border-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              style={{ fontFamily, fontSize: 18, lineHeight: 1.75 }}
              placeholder="Comienza a escribir tu escena aquí..."
              spellCheck={false}
            />
            {showSpellCheck && settings.spellCheck && spellCheckReady && (
              <SpellCheckOverlay
                text={text}
                misspelledWords={misspelledWords}
                getSuggestions={getSuggestions}
                fontSize={18}
                lineHeight={1.75}
                fontFamily={fontFamily}
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full overflow-auto prose prose-invert max-w-none rounded-3xl border border-slate-900 bg-slate-950/60 p-6" dangerouslySetInnerHTML={renderPreview()} />
        )}
      </div>
    </div>
  );
};

export default LexicalEditor;
