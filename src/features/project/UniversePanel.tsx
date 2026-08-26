import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  FileText,
  Folder,
  FolderPlus,
  Layers3,
  Plus,
  StickyNote,
  PencilLine,
  Compass,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useBackupStore } from '../../store/backupStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useNavigationStore } from '../../store/navigationStore';
import { TiptapEditor } from '../editor/TiptapEditor';
import { EmptyState } from '../../components/EmptyState';

interface UniverseEntry {
  id: string;
  name: string;
  type: 'folder' | 'entry';
  parentId: string | null;
  content: string;
  createdAt: string;
}

interface UniverseCategory {
  id: string;
  name: string;
  description: string;
  entries: UniverseEntry[];
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultCategories: UniverseCategory[] = [
  {
    id: 'characters',
    name: 'Personajes',
    description: 'Define perfiles, relaciones y motivaciones.',
    entries: [
      {
        id: 'folder-characters',
        name: 'Principales',
        type: 'folder',
        parentId: null,
        content: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'entry-lyra',
        name: 'Lyra',
        type: 'entry',
        parentId: 'folder-characters',
        content:
          '<h3>Lyra</h3><p>Escribe aquí la esencia del personaje, sus conflictos y su arco.</p>',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'places',
    name: 'Lugares',
    description: 'Organiza ubicaciones, ambientes y secretos.',
    entries: [
      {
        id: 'folder-places',
        name: 'Reinos',
        type: 'folder',
        parentId: null,
        content: '',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'items',
    name: 'Objetos',
    description: 'Guarda artefactos, reliquias y símbolos.',
    entries: [],
  },
];

const getChildren = (entries: UniverseEntry[], parentId: string | null) =>
  entries.filter((entry) => entry.parentId === parentId);

const findEntry = (entries: UniverseEntry[], id: string | null) =>
  entries.find((entry) => entry.id === id) ?? null;

// ─── RichTextEditor (contentEditable, same style as scene editor) ─────────────

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  saveLabel?: string;
  wordCount?: number;
  showWordCount?: boolean;
  onSelectionChange?: (selection: { start: number; end: number } | null) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escribe aquí el contenido...',
  saveLabel,
  wordCount = 0,
  showWordCount = true,
  onSelectionChange,
}) => {
  const [focusMode, setFocusMode] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const applyFormatRef = useRef<(command: string, valueArg?: string) => void>(() => {});

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Report selection as text offsets to parent
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) {
        onSelectionChange?.(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!editorRef.current.contains(range.startContainer)) {
        onSelectionChange?.(null);
        return;
      }
      // Get text content before selection start to calculate offset
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(editorRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const start = preSelectionRange.toString().length;
      const end = start + range.toString().length;
      onSelectionChange?.({ start, end });
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onSelectionChange]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Captura la selección ACTUAL del usuario, sea cual sea el gesto que la originó
  // (doble clic, triple clic o arrastre). Se llama justo antes de aplicar el
  // formato, NUNCA en el mousedown del editor: ese evento se dispara al inicio
  // del gesto de selección, antes de que el rango final quede definido, por lo
  // que capturarlo ahí siempre deja una selección obsoleta (p. ej. solo la
  // palabra del doble clic inicial, ignorando la ampliación por arrastre).
  const captureCurrentSelection = useCallback(() => {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      editorRef.current &&
      editorRef.current.contains(sel.anchorNode)
    ) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const applyFormat = useCallback((command: string, valueArg?: string) => {
    // Capturar la selección justo aquí, en el instante de aplicar el formato,
    // para que siempre refleje lo que el usuario ve resaltado en pantalla.
    captureCurrentSelection();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand(command, false, valueArg);
    handleInput();
  }, [captureCurrentSelection]);

  // Keep ref updated
  applyFormatRef.current = applyFormat;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onBold: () => applyFormatRef.current('bold'),
    onItalic: () => applyFormatRef.current('italic'),
    onUnderline: () => applyFormatRef.current('underline'),
    onStrikethrough: () => applyFormatRef.current('strikeThrough'),
  });

  const toolbarButtons: Array<{
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    action: () => void;
  }> = [
    { icon: Bold, label: 'Negrita', action: () => applyFormat('bold') },
    { icon: Italic, label: 'Cursiva', action: () => applyFormat('italic') },
    { icon: Underline, label: 'Subrayado', action: () => applyFormat('underline') },
    { icon: Strikethrough, label: 'Tachado', action: () => applyFormat('strikeThrough') },
  ];

  // Exit focus mode on ESC
  useEffect(() => {
    if (!focusMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [focusMode]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar - fixed */}
      {!focusMode && (
        <div className="flex flex-wrap items-center gap-1 px-4 py-2 border-b border-slate-800/70 bg-slate-900/40 shrink-0">
          {toolbarButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  btn.action();
                }}
                title={btn.label}
                className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:border-violet-500/60 hover:text-white hover:bg-slate-800 transition-colors"
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
              </button>
            );
          })}
          {saveLabel && (
            <span className="ml-auto text-xs text-slate-500 pr-2">{saveLabel}</span>
          )}
          <button
            type="button"
            onClick={() => setFocusMode(true)}
            title="Modo enfoque"
            className="ml-2 flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-400 hover:border-violet-500/60 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Focus mode exit hint */}
      {focusMode && (
        <div className="flex items-center justify-center py-1 bg-slate-900/80 border-b border-slate-800/50 text-[10px] text-slate-600">
          Pulsa <kbd className="mx-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">ESC</kbd> para salir del modo enfoque
          {showWordCount && wordCount > 0 && (
            <span className="ml-4 text-slate-500">{wordCount} palabras</span>
          )}
        </div>
      )}

      {/* Scrollable writing area — scroll vive SOLO aquí */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
        <div className="mx-auto" >
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xl shadow-slate-950/40 px-12 py-10 text-[19px] leading-[1.85] tracking-[0.01em] text-slate-200 outline-none min-h-[70vh]"
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
            }}
            data-placeholder={placeholder}
          />
        </div>
      </div>

      {/* Word count bar */}
      {!focusMode && showWordCount && (
        <div className="flex items-center justify-end gap-4 px-4 py-1.5 border-t border-slate-800/50 bg-slate-900/30 text-xs text-slate-500 shrink-0">
          <span>{wordCount} palabras</span>
        </div>
      )}
    </div>
  );
};

// ─── Vista de categoría (grid de cards) ────────────────────────────────────

const CategoriesView: React.FC<{
  categories: UniverseCategory[];
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => void;
}> = ({ categories, onSelect, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
    setName('');
    setDescription('');
  };

  return (
    <div className="mx-auto flex h-full min-h-[calc(100vh-120px)] max-w-7xl flex-col gap-5 px-4 pb-6 pt-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-violet-600/10 via-slate-900/70 to-slate-950/90 p-5 shadow-lg shadow-slate-950/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2.5 text-violet-300">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-violet-400">
                Universo
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                Construye tu mundo
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Selecciona una categoría para explorar o crear una nueva que
                organice tu mundo de ficción.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de categorías */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 text-left transition hover:border-violet-500/60 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-violet-950/20"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
              <Layers3 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white group-hover:text-violet-200">
              {cat.name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{cat.description}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Folder className="h-3.5 w-3.5" />
              {cat.entries.filter((e) => e.type === 'folder').length} carpetas
              <FileText className="ml-2 h-3.5 w-3.5" />
              {cat.entries.filter((e) => e.type === 'entry').length} fichas
            </div>
          </button>
        ))}

        {/* Card crear */}
        <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 p-5 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-400">
            <Plus className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-400">Nueva categoría</p>
        </div>
      </div>

      {/* Formulario crear categoría */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-5">
        <p className="mb-3 text-sm font-semibold text-slate-200">
          Crear nueva categoría
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej. Hechizos)"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve"
            className="flex-[2] rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Crear
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Vista de categoría abierta (dos columnas) ──────────────────────────────

const CategoryView: React.FC<{
  category: UniverseCategory;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  onUpdateEntry: (id: string, updates: Partial<UniverseEntry>) => void;
  onAddFolder: (name: string) => void;
  onAddEntry: (name: string, content: string) => void;
  onDeleteEntry: (id: string) => void;
  onBack: () => void;
}> = ({
  category,
  selectedEntryId,
  onSelectEntry,
  onUpdateEntry,
  onAddFolder,
  onAddEntry,
  onDeleteEntry,
  onBack,
}) => {
  const [newFolderName, setNewFolderName] = useState('');
  const [newEntryName, setNewEntryName] = useState('');
  const [folderError, setFolderError] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => findEntry(category.entries, selectedEntryId),
    [category.entries, selectedEntryId],
  );

  // Check for duplicate names in the current category
  const isDuplicateName = (name: string, excludeId?: string) => {
    return category.entries.some(
      (e) => e.name.toLowerCase() === name.toLowerCase() && e.id !== excludeId
    );
  };

  const handleAddFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setFolderError('El nombre es obligatorio');
      return;
    }
    if (isDuplicateName(trimmed)) {
      setFolderError('Ya existe una carpeta con este nombre');
      return;
    }
    setFolderError(null);
    onAddFolder(trimmed);
    setNewFolderName('');
  };

  const handleAddEntry = () => {
    const trimmed = newEntryName.trim();
    if (!trimmed) {
      setEntryError('El nombre es obligatorio');
      return;
    }
    if (isDuplicateName(trimmed)) {
      setEntryError('Ya existe una ficha con este nombre');
      return;
    }
    setEntryError(null);
    const defaultContent = `<h3>${trimmed}</h3><p>Escribe aquí la información sobre ${trimmed}.</p>`;
    onAddEntry(trimmed, defaultContent);
    setNewEntryName('');
  };

  // Renderiza el árbol de forma recursiva
  const renderTree = (entries: UniverseEntry[], parentId: string | null, depth = 0) => {
    const children = getChildren(entries, parentId);
    return (
      <div className={`space-y-1 ${depth > 0 ? 'w-full ml-4 border-l border-slate-800 pl-3' : ''}`}>
        {children.map((entry) => {
          const isActive = selectedEntryId === entry.id;
          const entryChildren = getChildren(entries, entry.id);
          return (
            <div key={entry.id}>
              <button
                type="button"
                onClick={() => onSelectEntry(entry.id)}
                className={`group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? 'border-violet-500 bg-violet-600/10 text-violet-200'
                    : 'border-transparent bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                {entry.type === 'folder' ? (
                  <Folder className="h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-sky-400" />
                )}
                <span className="truncate">{entry.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(entry.id);
                  }}
                  className="ml-auto hidden rounded-md p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-400 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
              {entry.type === 'folder' && entryChildren.length > 0 && renderTree(entries, entry.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 px-4 pb-6 pt-4">
      {/* Header con botón de vuelta */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-2 text-violet-300">
              <Layers3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-400">
                Categoría
              </p>
              <h2 className="font-bold text-white">{category.name}</h2>
            </div>
          </div>
          <p className="text-sm text-slate-400">{category.description}</p>
        </div>
      </div>

      {/* Dos columnas */}
      <div className="grid flex-1 gap-4 min-h-0 overflow-hidden" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Columna izquierda: sidebar con estructura */}
        <div className="flex min-h-0 w-[280px] flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
          <div className="border-b border-slate-800/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Estructura</p>
            <p className="text-xs text-slate-500">Carpetas y fichas</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
            {renderTree(category.entries, null)}
          </div>

          {/* Agregar carpeta */}
          <div className="border-t border-slate-800/70 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Nueva carpeta
            </p>
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  setFolderError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                placeholder="Nombre"
                className={`flex-1 rounded-lg border bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500 ${
                  folderError ? 'border-red-500' : 'border-slate-800'
                }`}
              />
              <button
                type="button"
                onClick={handleAddFolder}
                disabled={!newFolderName.trim() || !!folderError}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-sm text-slate-300 transition hover:border-violet-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Añadir</span>
              </button>
            </div>
            {folderError && <p className="text-xs text-red-400">{folderError}</p>}

            {/* Agregar entrada */}
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Nueva ficha
            </p>
            <input
              value={newEntryName}
              onChange={(e) => {
                setNewEntryName(e.target.value);
                setEntryError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
              placeholder="Nombre de la ficha"
              className={`w-full rounded-lg border bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500 ${
                entryError ? 'border-red-500' : 'border-slate-800'
              }`}
            />
            {entryError && <p className="text-xs text-red-400">{entryError}</p>}
            <button
              type="button"
              onClick={handleAddEntry}
              disabled={!newEntryName.trim() || !!entryError}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Guardar ficha
            </button>
          </div>
        </div>

        {/* Columna derecha: editor del elemento seleccionado */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
          <div className="border-b border-slate-800/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Editor</p>
            <p className="text-xs text-slate-500">
              {selectedEntry
                ? `Editando: ${selectedEntry.name}`
                : 'Selecciona un elemento para editarlo'}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
            {selectedEntry ? (
              <div className="flex h-full flex-col space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Nombre
                  </label>
                  <input
                    value={selectedEntry.name}
                    onChange={(e) =>
                      onUpdateEntry(selectedEntry.id, { name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500"
                  />
                </div>

                {selectedEntry.type === 'entry' ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Contenido
                    </label>
                    <div className="flex-1 min-h-0">
                      <RichTextEditor
                        value={selectedEntry.content}
                        onChange={(html) =>
                          onUpdateEntry(selectedEntry.id, { content: html })
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
                    <div className="flex items-center gap-2 text-slate-200">
                      <PencilLine className="h-4 w-4 text-violet-400" />
                      Esta carpeta es un contenedor. Agrega fichas en la barra
                      lateral.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState variant="universe" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SceneEditor: RichTextEditor con auto-guardado para App.tsx ──────────────

interface SceneEditorProps {
  sceneId: string;
  onStatsUpdate: (words: number, readTime: number) => void;
  onSelectionChange?: (selection: { from: number; to: number } | null) => void;
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ sceneId, onStatsUpdate, onSelectionChange }) => {
  const [content, setContent] = useState('');
  const saveTimeout = useRef<number | null>(null as any);
  const { activePath } = useProjectStore();
  const { createAutoBackup } = useBackupStore();

  // Load content on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loaded = await invoke<string | null>('get_scene_content', { nodeId: sceneId });
        if (!mounted) return;
        setContent(loaded ?? '');
      } catch (err) {
        console.error('Error loading scene:', err);
      }
    })();
    return () => { mounted = false; };
  }, [sceneId]);

  // Handle content change with autosave and auto-backup
  const handleChange = (newContent: string) => {
    setContent(newContent);
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(async () => {
      try {
        const plainText = newContent.replace(/<[^>]+>/g, ' ');
        await invoke('update_scene_content', { nodeId: sceneId, content: newContent, plainText });
        // Trigger auto-backup if enabled
        if (activePath) {
          createAutoBackup(activePath);
        }
      } catch (err) {
        console.error('Auto-save failed', err);
      }
    }, 700);
  };

  return (
    <TiptapEditor
      content={content}
      onChange={handleChange}
      placeholder="Comienza a escribir tu escena aquí..."
      onStatsUpdate={onStatsUpdate}
      onSelectionChange={onSelectionChange}
    />
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const UniversePanel: React.FC = () => {
  const { isOpen, currentProject } = useProjectStore();
  const { selectedUniverseCategoryId, selectedUniverseEntryId, setSelectedUniverse } = useNavigationStore();
  const [categories, setCategories] = useState<UniverseCategory[]>(defaultCategories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const isInsideCategory = selectedCategoryId !== null;

  useEffect(() => {
    if (!isOpen) {
      setCategories(defaultCategories);
      setSelectedCategoryId(null);
      setSelectedEntryId(null);
      setIsHydrated(false);
      return;
    }

    const loadUniverseData = async () => {
      try {
        const storedData = await invoke<UniverseCategory[]>('get_universe_data');
        if (storedData?.length) {
          setCategories(storedData);
        } else {
          setCategories(defaultCategories);
        }
      } catch (error) {
        console.error('No se pudo cargar el universo del proyecto:', error);
        setCategories(defaultCategories);
      } finally {
        setIsHydrated(true);
      }
    };

    void loadUniverseData();
  }, [isOpen, currentProject?.id]);

  // Sync with navigation store (for search navigation)
  useEffect(() => {
    if (!isHydrated) return;

    if (selectedUniverseCategoryId) {
      // Check if category exists
      const catExists = categories.some(c => c.id === selectedUniverseCategoryId);
      if (catExists) {
        setSelectedCategoryId(selectedUniverseCategoryId);
        // If we also have an entry to select, set it after a brief delay to allow state to settle
        if (selectedUniverseEntryId) {
          // Small delay to ensure the category view is rendered first
          setTimeout(() => {
            setSelectedEntryId(selectedUniverseEntryId);
            // Clear the navigation state so repeated searches work correctly
            setSelectedUniverse(null, null);
          }, 50);
        }
      }
    }
  }, [selectedUniverseCategoryId, selectedUniverseEntryId, isHydrated, categories, setSelectedUniverse]);

  useEffect(() => {
    if (!isOpen || !isHydrated) return;

    const saveUniverseData = async () => {
      try {
        await invoke('save_universe_data', { data: categories });
      } catch (error) {
        console.error('No se pudo guardar el universo en el proyecto:', error);
      }
    };

    void saveUniverseData();
  }, [categories, isHydrated, isOpen]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const handleCreateCategory = (name: string, description: string) => {
    const nextCategory: UniverseCategory = {
      id: createId(),
      name,
      description: description || 'Nueva categoría de universo.',
      entries: [],
    };
    setCategories((current) => [...current, nextCategory]);
  };

  const handleSelectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setSelectedEntryId(null);
  };

  const handleBackToCategories = () => {
    setSelectedCategoryId(null);
    setSelectedEntryId(null);
  };

  const handleSelectEntry = (id: string | null) => {
    setSelectedEntryId(id);
  };

  const handleAddFolder = (name: string) => {
    if (!selectedCategory) return;
    const parentId =
      selectedEntryId && findEntry(selectedCategory.entries, selectedEntryId)?.type === 'folder'
        ? selectedEntryId
        : null;

    const newFolder: UniverseEntry = {
      id: createId(),
      name,
      type: 'folder',
      parentId,
      content: '',
      createdAt: new Date().toISOString(),
    };

    setCategories((current) =>
      current.map((cat) =>
        cat.id === selectedCategory.id
          ? { ...cat, entries: [...cat.entries, newFolder] }
          : cat,
      ),
    );
    setSelectedEntryId(newFolder.id);
  };

  const handleAddEntry = (name: string, content: string) => {
    if (!selectedCategory) return;
    const parentId =
      selectedEntryId && findEntry(selectedCategory.entries, selectedEntryId)?.type === 'folder'
        ? selectedEntryId
        : null;

    const newEntry: UniverseEntry = {
      id: createId(),
      name,
      type: 'entry',
      parentId,
      content,
      createdAt: new Date().toISOString(),
    };

    setCategories((current) =>
      current.map((cat) =>
        cat.id === selectedCategory.id
          ? { ...cat, entries: [...cat.entries, newEntry] }
          : cat,
      ),
    );
    setSelectedEntryId(newEntry.id);
  };

  const handleUpdateEntry = (id: string, updates: Partial<UniverseEntry>) => {
    if (!selectedCategory) return;
    setCategories((current) =>
      current.map((cat) =>
        cat.id === selectedCategory.id
          ? {
              ...cat,
              entries: cat.entries.map((e) =>
                e.id === id ? { ...e, ...updates } : e,
              ),
            }
          : cat,
      ),
    );
  };

  const handleDeleteEntry = (id: string) => {
    if (!selectedCategory) return;
    setCategories((current) =>
      current.map((cat) =>
        cat.id === selectedCategory.id
          ? { ...cat, entries: cat.entries.filter((e) => e.id !== id) }
          : cat,
      ),
    );
    if (selectedEntryId === id) {
      setSelectedEntryId(null);
    }
  };

  if (!isOpen) return null;

  if (isInsideCategory && selectedCategory) {
    return (
      <CategoryView
        category={selectedCategory}
        selectedEntryId={selectedEntryId}
        onSelectEntry={handleSelectEntry}
        onUpdateEntry={handleUpdateEntry}
        onAddFolder={handleAddFolder}
        onAddEntry={handleAddEntry}
        onDeleteEntry={handleDeleteEntry}
        onBack={handleBackToCategories}
      />
    );
  }

  return (
    <CategoriesView
      categories={categories}
      onSelect={handleSelectCategory}
      onCreate={handleCreateCategory}
    />
  );
};