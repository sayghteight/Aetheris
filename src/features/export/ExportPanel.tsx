import React, { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  ArrowLeft,
  FileText,
  FileCode,
  FileType,
  Globe,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Settings2,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useManuscriptStore, ManuscriptNode } from '../../store/manuscriptStore';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown' | 'txt';

interface ExportOptions {
  includeSceneTitles: boolean;
  includeSynopsis: boolean;
  includeAuthorNotes: boolean;
  includeChapterTitles: boolean;
  includePartTitles: boolean;
}

// ─── Format Icons ───────────────────────────────────────────────────────────

const FormatIcon = ({ format, className }: { format: ExportFormat; className?: string }) => {
  const iconClass = `w-5 h-5 ${className || ''}`;
  switch (format) {
    case 'pdf':
      return <FileText className={iconClass} />;
    case 'docx':
      return <FileType className={iconClass} />;
    case 'html':
      return <Globe className={iconClass} />;
    case 'markdown':
      return <FileCode className={iconClass} />;
    case 'txt':
      return <FileCode className={iconClass} />;
  }
};

// ─── Tree Building ──────────────────────────────────────────────────────────

interface SceneInfo {
  id: string;
  title: string;
}

interface ChapterInfo {
  id: string;
  title: string;
  scenes: SceneInfo[];
}

interface PartInfo {
  id: string;
  title: string;
  chapters: ChapterInfo[];
}

const buildTree = (nodes: ManuscriptNode[]): { parts: PartInfo[]; orphanChapters: ChapterInfo[] } => {
  const parts: PartInfo[] = [];
  const orphanChapters: ChapterInfo[] = [];
  const partsAndFolders = nodes.filter((n) => n.type === 'part' || n.type === 'folder');
  const chapters = nodes.filter((n) => n.type === 'chapter');
  const scenes = nodes.filter((n) => n.type === 'scene');

  for (const pf of partsAndFolders) {
    const partChapters: ChapterInfo[] = [];
    const directChapters = chapters.filter((c) => c.parent_id === pf.id);
    for (const ch of directChapters) {
      const chScenes = scenes.filter((s) => s.parent_id === ch.id).map((s) => ({ id: s.id, title: s.title }));
      partChapters.push({ id: ch.id, title: ch.title, scenes: chScenes });
    }
    const childFolders = partsAndFolders.filter((f) => f.parent_id === pf.id);
    for (const cf of childFolders) {
      const cfChapters = chapters.filter((c) => c.parent_id === cf.id);
      for (const ch of cfChapters) {
        const chScenes = scenes.filter((s) => s.parent_id === ch.id).map((s) => ({ id: s.id, title: s.title }));
        partChapters.push({ id: ch.id, title: ch.title, scenes: chScenes });
      }
    }
    if (partChapters.length > 0 || directChapters.length > 0) {
      parts.push({ id: pf.id, title: pf.title, chapters: partChapters });
    }
  }

  for (const ch of chapters) {
    const parentIsPartOrFolder = partsAndFolders.some((pf) => pf.id === ch.parent_id);
    if (!parentIsPartOrFolder) {
      const chScenes = scenes.filter((s) => s.parent_id === ch.id).map((s) => ({ id: s.id, title: s.title }));
      orphanChapters.push({ id: ch.id, title: ch.title, scenes: chScenes });
    }
  }

  return { parts, orphanChapters };
};

// ─── Preview Modal ──────────────────────────────────────────────────────────

const PreviewModal = ({
  format,
  sceneIds,
  options,
  onClose,
}: {
  format: ExportFormat;
  sceneIds: string[] | null;
  options: ExportOptions;
  onClose: () => void;
}) => {
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      try {
        // Only HTML, Markdown, TXT support preview
        const previewFormat = format === 'docx' || format === 'pdf' ? 'html' : format;
        const data: number[] = await invoke('export_preview', {
          format: previewFormat,
          sceneIds,
          options,
        });
        const text = new TextDecoder().decode(new Uint8Array(data));
        setPreview(text);
      } catch (err) {
        console.error('Preview error:', err);
        setPreview('Error cargando vista previa');
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [format, sceneIds, options]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Vista previa</h3>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 uppercase">
              {format}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : (
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-slate-950 rounded-xl p-4 border border-slate-800">
              {preview}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Scene Selector ────────────────────────────────────────────────────────

const SceneSelector = ({
  tree,
  selectedSceneIds,
  onToggleScene,
  onToggleAll,
  selectAll,
}: {
  tree: { parts: PartInfo[]; orphanChapters: ChapterInfo[] };
  selectedSceneIds: Set<string>;
  onToggleScene: (id: string) => void;
  onToggleAll: () => void;
  selectAll: boolean;
}) => {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set(tree.parts.map((p) => p.id)));
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const togglePart = (id: string) => {
    const next = new Set(expandedParts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedParts(next);
  };

  const toggleChapter = (id: string) => {
    const next = new Set(expandedChapters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedChapters(next);
  };

  const totalScenes = tree.parts.reduce((acc, p) => acc + p.chapters.reduce((a, c) => a + c.scenes.length, 0), 0) +
    tree.orphanChapters.reduce((a, c) => a + c.scenes.length, 0);

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Contenido</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectAll ? `${totalScenes} escenas` : `${selectedSceneIds.size} de ${totalScenes} escenas`}
          </p>
        </div>
        <button
          onClick={onToggleAll}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            selectAll
              ? 'bg-amber-500 text-black'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          {selectAll ? 'Todas' : 'Ninguna'}
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-4 space-y-3">
        {tree.parts.map((part) => (
          <div key={part.id} className="space-y-1">
            {/* Part Header */}
            <button
              onClick={() => togglePart(part.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-left"
            >
              {expandedParts.has(part.id) ? (
                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="text-sm font-semibold text-slate-300 truncate">{part.title}</span>
              <span className="ml-auto text-xs text-slate-600">
                {part.chapters.reduce((a, c) => a + c.scenes.length, 0)} escenas
              </span>
            </button>

            {/* Chapters */}
            {expandedParts.has(part.id) && (
              <div className="ml-4 space-y-1">
                {part.chapters.map((chapter) => (
                  <div key={chapter.id}>
                    <button
                      onClick={() => toggleChapter(chapter.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800/30 transition-colors text-left"
                    >
                      {expandedChapters.has(chapter.id) ? (
                        <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-slate-400 truncate">{chapter.title}</span>
                    </button>

                    {expandedChapters.has(chapter.id) && (
                      <div className="ml-6 space-y-0.5 mt-1">
                        {chapter.scenes.map((scene) => (
                          <label
                            key={scene.id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/20 cursor-pointer group"
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                selectedSceneIds.has(scene.id)
                                  ? 'bg-amber-500 border-amber-500'
                                  : 'border-slate-600 group-hover:border-slate-500'
                              }`}
                            >
                              {selectedSceneIds.has(scene.id) && <Check className="w-2.5 h-2.5 text-black" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedSceneIds.has(scene.id)}
                              onChange={() => onToggleScene(scene.id)}
                              className="sr-only"
                            />
                            <span className="text-xs text-slate-500 truncate group-hover:text-slate-400">
                              {scene.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Orphan Chapters */}
        {tree.orphanChapters.length > 0 && (
          <div className="pt-2 border-t border-slate-800/40 space-y-1">
            <p className="text-xs font-medium text-slate-600 px-3 py-1">Capítulos independientes</p>
            {tree.orphanChapters.map((chapter) => (
              <div key={chapter.id}>
                <div className="text-xs font-medium text-slate-500 px-3 py-1">{chapter.title}</div>
                <div className="ml-4 space-y-0.5">
                  {chapter.scenes.map((scene) => (
                    <label
                      key={scene.id}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800/20 cursor-pointer group"
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selectedSceneIds.has(scene.id)
                            ? 'bg-amber-500 border-amber-500'
                            : 'border-slate-600 group-hover:border-slate-500'
                        }`}
                      >
                        {selectedSceneIds.has(scene.id) && <Check className="w-2.5 h-2.5 text-black" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedSceneIds.has(scene.id)}
                        onChange={() => onToggleScene(scene.id)}
                        className="sr-only"
                      />
                      <span className="text-xs text-slate-500 truncate group-hover:text-slate-400">
                        {scene.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Options Panel ──────────────────────────────────────────────────────────

const OptionsPanel = ({
  options,
  onChange,
}: {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (key: keyof ExportOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings2 className="w-4 h-4 text-slate-400" />
          <span className="text-white font-medium">Opciones</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-4 border-t border-slate-800/60 space-y-3 pt-4">
          {[
            { key: 'includePartTitles', label: 'Títulos de partes' },
            { key: 'includeChapterTitles', label: 'Títulos de capítulos' },
            { key: 'includeSceneTitles', label: 'Títulos de escenas' },
            { key: 'includeSynopsis', label: 'Synopsis' },
            { key: 'includeAuthorNotes', label: 'Notas del autor' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => toggle(key as keyof ExportOptions)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${
                  options[key as keyof ExportOptions]
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-slate-600 group-hover:border-slate-500'
                }`}
              >
                {options[key as keyof ExportOptions] && <Check className="w-3 h-3 text-black" />}
              </div>
              <input
                type="checkbox"
                checked={options[key as keyof ExportOptions]}
                onChange={() => toggle(key as keyof ExportOptions)}
                className="sr-only"
              />
              <span className="text-sm text-slate-400 group-hover:text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Export Panel ──────────────────────────────────────────────────────

export const ExportPanel: React.FC = () => {
  const { setActiveView } = useWorkspaceStore();
  const { nodes: manuscriptNodes } = useManuscriptStore();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [options, setOptions] = useState<ExportOptions>({
    includeSceneTitles: true,
    includeSynopsis: false,
    includeAuthorNotes: false,
    includeChapterTitles: true,
    includePartTitles: true,
  });
  const [previewFormat, setPreviewFormat] = useState<ExportFormat | null>(null);

  const tree = useMemo(() => buildTree(manuscriptNodes), [manuscriptNodes]);

  const allSceneIds = useMemo(() => {
    const ids: string[] = [];
    for (const part of tree.parts) {
      for (const ch of part.chapters) {
        ids.push(...ch.scenes.map((s) => s.id));
      }
    }
    for (const ch of tree.orphanChapters) {
      ids.push(...ch.scenes.map((s) => s.id));
    }
    return ids;
  }, [tree]);

  const totalScenes = allSceneIds.length;

  React.useEffect(() => {
    if (selectAll) {
      setSelectedSceneIds(new Set(allSceneIds));
    }
  }, [selectAll, allSceneIds]);

  const toggleScene = (sceneId: string) => {
    const newSelected = new Set(selectedSceneIds);
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId);
    } else {
      newSelected.add(sceneId);
    }
    setSelectedSceneIds(newSelected);
    if (newSelected.size < totalScenes) {
      setSelectAll(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedSceneIds(new Set());
      setSelectAll(false);
    } else {
      setSelectedSceneIds(new Set(allSceneIds));
      setSelectAll(true);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setError(null);

    try {
      const extensions: Record<ExportFormat, string> = {
        pdf: 'pdf',
        docx: 'docx',
        html: 'html',
        markdown: 'md',
        txt: 'txt',
      };

      const filePath = await save({
        filters: [
          {
            name: format.toUpperCase(),
            extensions: [extensions[format]],
          },
        ],
        defaultPath: `manuscript.${extensions[format]}`,
      });

      if (!filePath) {
        setExporting(null);
        return;
      }

      const sceneIdsToExport = selectAll ? null : selectedSceneIds.size > 0 ? Array.from(selectedSceneIds) : null;

      const data: number[] = await invoke('export_manuscript', {
        format,
        sceneIds: sceneIdsToExport,
      });

      await invoke('save_exported_file', { path: filePath, data });
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al exportar');
    } finally {
      setExporting(null);
    }
  };

  const sceneIdsToExport = selectAll ? null : selectedSceneIds.size > 0 ? Array.from(selectedSceneIds) : null;
  const exportCount = selectAll ? totalScenes : selectedSceneIds.size;

  const formats: { id: ExportFormat; name: string; desc: string; badge?: string }[] = [
    { id: 'pdf', name: 'PDF', desc: 'Para imprenta o compartir documentos', badge: 'Experimental' },
    { id: 'docx', name: 'Word', desc: 'Compatible con Microsoft Word' },
    { id: 'html', name: 'HTML', desc: 'Publicación web o conversión' },
    { id: 'markdown', name: 'Markdown', desc: 'Editores de texto avanzados' },
    { id: 'txt', name: 'Texto', desc: 'Archivo de texto plano' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('manuscript')}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <h1 className="text-xl font-bold text-white">Exportar manuscrito</h1>
              <p className="text-xs text-slate-500">
                {selectAll ? `${totalScenes} escenas` : `${exportCount} de ${totalScenes} escenas`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column - Scene Selection & Options */}
          <div className="lg:col-span-2 space-y-4">
            <SceneSelector
              tree={tree}
              selectedSceneIds={selectedSceneIds}
              onToggleScene={toggleScene}
              onToggleAll={toggleSelectAll}
              selectAll={selectAll}
            />
            <OptionsPanel options={options} onChange={setOptions} />
          </div>

          {/* Right Column - Format Selection */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Formato de exportación</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formats.map((fmt) => {
                  const isExporting = exporting === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      onClick={() => handleExport(fmt.id)}
                      disabled={exporting !== null}
                      className="group relative flex items-start gap-4 p-5 rounded-2xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/80 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:from-amber-500/30 group-hover:to-orange-600/30 transition-all">
                        {isExporting ? (
                          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                        ) : (
                          <FormatIcon format={fmt.id} className="text-amber-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold mb-0.5 flex items-center gap-2">
                          {fmt.name}
                          {fmt.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wide">
                              {fmt.badge}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">{fmt.desc}</p>
                      </div>

                      {/* Preview button */}
                      {(fmt.id === 'html' || fmt.id === 'markdown' || fmt.id === 'txt') && !isExporting && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewFormat(fmt.id);
                          }}
                          className="absolute -top-2 -right-2 p-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-amber-500/50 transition-all opacity-0 group-hover:opacity-100"
                          title="Vista previa"
                        >
                          <Eye className="w-3 h-3 text-slate-400" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="rounded-xl border border-slate-800/60 bg-slate-900/20 p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500">
                Los formatos DOCX y PDF usan configuración optimizada automáticamente. Usa las opciones para
                personalizar qué elementos incluir en la exportación.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-red-800/60 bg-red-950/90 px-5 py-3 text-sm text-red-300 shadow-xl">
          {error}
        </div>
      )}

      {/* Preview Modal */}
      {previewFormat && (
        <PreviewModal
          format={previewFormat}
          sceneIds={sceneIdsToExport}
          options={options}
          onClose={() => setPreviewFormat(null)}
        />
      )}
    </div>
  );
};

export default ExportPanel;
