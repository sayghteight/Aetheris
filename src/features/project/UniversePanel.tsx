import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  minHeight?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escribe aquí el contenido...',
  minHeight = '240px',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Guardar selección cuando el editor pierde el foco (antes de que el click la borre)
  const handleEditorMouseDown = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const applyFormat = (command: string, valueArg?: string) => {
    // Restaurar selección guardada antes de aplicar el comando
    if (savedRange.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    document.execCommand(command, false, valueArg);
    handleInput();
  };

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

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-800/70 p-2">
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
              className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 hover:border-violet-500 hover:text-white transition-colors"
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseDown={handleEditorMouseDown}
        className="overflow-y-auto p-4 text-sm leading-7 text-slate-200 outline-none scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950"
        style={{
          minHeight,
          whiteSpace: 'pre-wrap',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        }}
        data-placeholder={placeholder}
      />
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
    <div className="mx-auto flex h-full min-h-[calc(100vh-120px)] max-w-7xl flex-col gap-5 px-4 pb-6">
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

  const selectedEntry = useMemo(
    () => findEntry(category.entries, selectedEntryId),
    [category.entries, selectedEntryId],
  );

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    onAddFolder(newFolderName.trim());
    setNewFolderName('');
  };

  const handleAddEntry = () => {
    if (!newEntryName.trim()) return;
    const defaultContent = `<h3>${newEntryName.trim()}</h3><p>Escribe aquí la información sobre ${newEntryName.trim()}.</p>`;
    onAddEntry(newEntryName.trim(), defaultContent);
    setNewEntryName('');
  };

  // Renderiza el árbol de forma recursiva
  const renderTree = (entries: UniverseEntry[], parentId: string | null, depth = 0) => {
    const children = getChildren(entries, parentId);
    return (
      <div className={`space-y-1 ${depth > 0 ? 'ml-4 border-l border-slate-800 pl-3' : ''}`}>
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
    <div className="mx-auto flex h-full min-h-[calc(100vh-120px)] max-w-7xl flex-col gap-4 px-4 pb-6">
      {/* Header con botón de vuelta */}
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
        <p className="ml-2 text-sm text-slate-400">{category.description}</p>
      </div>

      {/* Dos columnas */}
      <div className="grid flex-1 gap-4 min-h-0" style={{ gridTemplateColumns: '280px 1fr' }}>
        {/* Columna izquierda: sidebar con estructura */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
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
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                placeholder="Nombre"
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={handleAddFolder}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-sm text-slate-300 transition hover:border-violet-500 hover:text-white"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Añadir</span>
              </button>
            </div>

            {/* Agregar entrada */}
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Nueva ficha
            </p>
            <input
              value={newEntryName}
              onChange={(e) => setNewEntryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
              placeholder="Nombre de la ficha"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-violet-500"
            />
            <button
              type="button"
              onClick={handleAddEntry}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Guardar ficha
            </button>
          </div>
        </div>

        {/* Columna derecha: editor del elemento seleccionado */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
          <div className="border-b border-slate-800/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Editor</p>
            <p className="text-xs text-slate-500">
              {selectedEntry
                ? `Editando: ${selectedEntry.name}`
                : 'Selecciona un elemento para editarlo'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
            {selectedEntry ? (
              <div className="space-y-4">
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
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Contenido
                    </label>
                    <RichTextEditor
                      value={selectedEntry.content}
                      onChange={(html) =>
                        onUpdateEntry(selectedEntry.id, { content: html })
                      }
                      minHeight="320px"
                    />
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
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                  Selecciona una carpeta o ficha en la estructura para
                  editarla, o crea una nueva.
                </div>
              </div>
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
}

export const SceneEditor: React.FC<SceneEditorProps> = ({ sceneId, onStatsUpdate }) => {
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveTimeout = useRef<number | null>(null as any);
  const lastStats = useRef({ words: 0, readTime: 0 });

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

  const computeStats = (value: string) => {
    const stripped = value.replace(/<[^>]+>/g, ' ').trim();
    const words = stripped === '' ? 0 : stripped.split(/\s+/).length;
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

  const saveContent = async (newContent: string) => {
    setSaveStatus('saving');
    try {
      const plainText = newContent.replace(/<[^>]+>/g, ' ');
      await invoke('update_scene_content', { nodeId: sceneId, content: newContent, plainText });
      setSaveStatus('saved');
      setLastSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Auto-save failed', err);
      setSaveStatus('error');
    }
  };

  const scheduleSave = (newContent: string) => {
    setContent(newContent);
    updateStats(newContent);
    if (saveTimeout.current) window.clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(() => saveContent(newContent), 700);
  };

  const saveLabel =
    saveStatus === 'saving'
      ? 'Guardando…'
      : saveStatus === 'saved'
        ? `Guardado ${lastSavedAt ?? ''}`
        : saveStatus === 'error'
          ? 'Error al guardar'
          : 'Sin cambios';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950/40 border border-slate-900 rounded-3xl overflow-hidden shadow-xl shadow-slate-950/20">
      <RichTextEditor
        value={content}
        onChange={scheduleSave}
        placeholder="Comienza a escribir tu escena aquí..."
        minHeight="calc(100vh - 240px)"
      />
      <div className="px-4 py-2 border-t border-slate-800/70 text-xs text-slate-500">
        {saveLabel}
      </div>
    </div>
  );
};

// ─── Componente principal ────────────────────────────────────────────────────

export const UniversePanel: React.FC = () => {
  const { isOpen, currentProject } = useProjectStore();
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
