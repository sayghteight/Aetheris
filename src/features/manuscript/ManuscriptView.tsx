import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useManuscriptStore, ManuscriptNode } from '../../store/manuscriptStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useWorkspaceStore, scheduleWorkspaceSave } from '../../store/workspaceStore';
import { useI18n } from '../../i18n';
import { SceneEditor } from '../project/UniversePanel';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Folder,
  FileText,
  Plus,
  PlusCircle,
  BookOpen as BookOpenIcon,
  Target,
  StickyNote,
  Trash2,
} from 'lucide-react';

export const ManuscriptView: React.FC = () => {
  const { t } = useI18n();
  const { nodes, fetchNodes, createNode, updateNode, deleteNode } = useManuscriptStore();
  const { activeSceneId, setActiveSceneId, selectedNodeId, setSelectedNodeId } = useNavigationStore();
  const {
    expandedNodeIds,
    setExpandedNodeIds,
    treeScrollPosition,
    setTreeScrollPosition,
    isLoaded,
    sidebarExpanded,
    setSidebarExpanded,
  } = useWorkspaceStore();

  const treeRef = useRef<HTMLDivElement>(null);
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootTitle, setNewRootTitle] = useState('');
  const [newRootType, setNewRootType] = useState<'part' | 'chapter' | 'scene' | 'folder'>('part');
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [newChildType, setNewChildType] = useState<'part' | 'chapter' | 'scene' | 'folder'>('scene');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const expandedMap = expandedNodeIds.reduce(
    (acc, id) => ({ ...acc, [id]: true }),
    {} as Record<string, boolean>
  );

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    if (isLoaded && treeScrollPosition > 0 && treeRef.current) {
      requestAnimationFrame(() => {
        if (treeRef.current) treeRef.current.scrollTop = treeScrollPosition;
      });
    }
  }, [isLoaded, treeScrollPosition]);

  const toggleExpand = (id: string) => {
    const newIds = expandedMap[id]
      ? expandedNodeIds.filter(nid => nid !== id)
      : [...expandedNodeIds, id];
    setExpandedNodeIds(newIds);
    scheduleWorkspaceSave();
  };

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootTitle.trim()) return;
    try {
      const created = await createNode(null, newRootTitle.trim(), newRootType);
      setNewRootTitle('');
      setIsAddingRoot(false);
      setSelectedNodeId(created.id);
      if (created.type === 'scene') setActiveSceneId(created.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChild = async (parentId: string) => {
    if (!newChildTitle.trim()) return;
    try {
      const created = await createNode(parentId, newChildTitle.trim(), newChildType);
      if (!expandedNodeIds.includes(parentId)) {
        setExpandedNodeIds([...expandedNodeIds, parentId]);
      }
      setNewChildTitle('');
      setAddingChildTo(null);
      setSelectedNodeId(created.id);
      if (created.type === 'scene') setActiveSceneId(created.id);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditingTitle = (node: ManuscriptNode) => {
    setEditingNodeId(node.id);
    setEditingTitle(node.title);
  };

  const handleRename = async () => {
    if (!editingNodeId || !editingTitle.trim()) {
      setEditingNodeId(null);
      return;
    }
    const node = nodes.find(n => n.id === editingNodeId);
    if (node) {
      await updateNode(editingNodeId, { ...node, title: editingTitle.trim() });
    }
    setEditingNodeId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNode(id);
      if (selectedNodeId === id) setSelectedNodeId(null);
      if (activeSceneId === id) setActiveSceneId(null);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  const rootNodes = nodes.filter(n => !n.parent_id);
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId);
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  const handleMetadataChange = useCallback(
    (field: 'synopsis' | 'writing_goals' | 'author_notes', value: string) => {
      if (!selectedNode) return;
      updateNode(selectedNode.id, { ...selectedNode, [field]: value || null });
    },
    [selectedNode, updateNode]
  );

  const renderNode = (node: ManuscriptNode, depth: number = 0) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedMap[node.id];
    const isActive = selectedNodeId === node.id;
    const isEditing = editingNodeId === node.id;

    let Icon = FileText;
    let iconColor = 'text-slate-400';
    if (node.type === 'part') { Icon = BookOpen; iconColor = 'text-violet-400'; }
    else if (node.type === 'chapter' || node.type === 'folder') { Icon = Folder; iconColor = 'text-amber-400'; }

    return (
      <div key={node.id}>
        <div
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-all duration-150 ${
            isActive ? 'bg-violet-600/20 border-l-2 border-violet-500 text-violet-200' : 'hover:bg-slate-900/60 text-slate-300'
          }`}
          onClick={() => {
            setSelectedNodeId(node.id);
            if (node.type === 'scene') setActiveSceneId(node.id);
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            {node.type !== 'scene' ? (
              <span
                onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                className="p-0.5 hover:bg-slate-800 rounded text-slate-500"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-4" />
            )}
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setEditingNodeId(null);
                }}
                onClick={e => e.stopPropagation()}
                className="bg-slate-800 border border-violet-500 rounded px-1 py-0.5 text-sm text-white outline-none flex-1"
              />
            ) : (
              <span className="text-sm truncate font-medium">{node.title}</span>
            )}
          </div>

          {/* Node actions */}
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            {node.type !== 'scene' && (
              <button
                onClick={(e) => { e.stopPropagation(); setAddingChildTo(node.id); setNewChildType(node.type === 'part' ? 'chapter' : 'scene'); }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                title="Añadir"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); startEditingTitle(node); }}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
              title="Renombrar"
            >
              <FileText className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(node.id); }}
              className="p-1 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Delete confirm */}
        {showDeleteConfirm === node.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }} className="py-1 pr-2">
            <div className="flex items-center gap-2 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-2">
              <span className="text-xs text-red-300 flex-1">{t('manuscript.deleteConfirm') || '¿Eliminar este nodo?'}</span>
              <button onClick={() => handleDelete(node.id)} className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-semibold">{t('common.delete')}</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {/* Add child form */}
        {addingChildTo === node.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }} className="py-2 pr-2">
            <div className="flex flex-col gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-900">
              <input
                type="text"
                autoFocus
                value={newChildTitle}
                onChange={e => setNewChildTitle(e.target.value)}
                placeholder="Título..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded px-2 py-1 text-xs outline-none"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddChild(node.id);
                  if (e.key === 'Escape') setAddingChildTo(null);
                }}
              />
              <div className="flex justify-between items-center gap-2">
                <select value={newChildType} onChange={e => setNewChildType(e.target.value as any)} className="bg-slate-900 border border-slate-850 rounded text-[10px] text-slate-350 px-1 py-0.5 outline-none">
                  <option value="scene">Escena</option>
                  <option value="chapter">Capítulo</option>
                  <option value="folder">Carpeta</option>
                </select>
                <div className="flex gap-1.5">
                  <button onClick={() => setAddingChildTo(null)} className="text-[10px] text-slate-500 hover:text-slate-300">{t('common.cancel')}</button>
                  <button onClick={() => handleAddChild(node.id)} className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-2 py-0.5 rounded font-semibold">{t('common.create')}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {node.type !== 'scene' && isExpanded && hasChildren && (
          <div className="mt-0.5">
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ─── Main Content ─────────────────────────────────────────────
  const renderMainContent = () => {
    if (!selectedNode) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 mb-4 text-slate-400">
            <BookOpenIcon className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-300">{t('editor.noSceneSelected')}</h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xs">
            Selecciona un nodo del árbol lateral para comenzar.
          </p>
        </div>
      );
    }

    if (selectedNode.type === 'scene') {
      return (
        <div className="flex-1 flex flex-col min-h-0">
          <SceneEditor
            sceneId={selectedNode.id}
            onStatsUpdate={() => {}}
          />
        </div>
      );
    }

    // Chapter/part/folder — metadata panel
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            {selectedNode.type === 'part' ? (
              <BookOpenIcon className="w-6 h-6 text-violet-400" />
            ) : (
              <Folder className="w-6 h-6 text-amber-400" />
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{selectedNode.title}</h2>
              <p className="text-xs text-slate-500 capitalize">{t(`manuscript.${selectedNode.type}`) || selectedNode.type}</p>
            </div>
          </div>

          {/* Synopsis */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpenIcon className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('manuscript.synopsis')}</h3>
            </div>
            <textarea
              value={selectedNode.synopsis ?? ''}
              onChange={e => handleMetadataChange('synopsis', e.target.value)}
              rows={5}
              placeholder={t('manuscript.synopsisPlaceholder') || 'Escribe la sinopsis de este capítulo...'}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Writing Goals */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('manuscript.writingGoals')}</h3>
            </div>
            <textarea
              value={selectedNode.writing_goals ?? ''}
              onChange={e => handleMetadataChange('writing_goals', e.target.value)}
              rows={4}
              placeholder={t('manuscript.writingGoalsPlaceholder') || '¿Qué quieres lograr con este capítulo?'}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Author Notes */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <StickyNote className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('manuscript.authorNotes')}</h3>
            </div>
            <textarea
              value={selectedNode.author_notes ?? ''}
              onChange={e => handleMetadataChange('author_notes', e.target.value)}
              rows={5}
              placeholder={t('manuscript.authorNotesPlaceholder') || 'Notas privadas sobre este capítulo...'}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Stats footer */}
          <div className="flex items-center justify-between text-xs text-slate-600 pt-2">
            <span>{childrenCount(selectedNode.id)} {t('manuscript.childNodes') || 'elementos hijos'}</span>
            <span>{t('manuscript.status')}: <span className="text-slate-400 capitalize">{selectedNode.status}</span></span>
          </div>
        </div>
      </div>
    );
  };

  const childrenCount = (nodeId: string) => getChildren(nodeId).length;

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Sidebar — Tree */}
      <div
        className={`flex flex-col shrink-0 border-r border-slate-800/80 bg-slate-950/50 transition-all duration-200 ${
          sidebarExpanded ? 'w-64' : 'w-10'
        }`}
      >
        {/* Header */}
        <div className="px-3 py-3 border-b border-slate-900 flex items-center justify-between gap-2">
          {sidebarExpanded && (
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manuscrito</h2>
          )}
          <button
            onClick={() => { setSidebarExpanded(!sidebarExpanded); scheduleWorkspaceSave(); }}
            className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-300 rounded transition-colors shrink-0"
            title={sidebarExpanded ? 'Colapsar' : 'Expandir'}
          >
            {sidebarExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Tree content */}
        {sidebarExpanded && (
          <>
            <div className="px-2 py-2 border-b border-slate-900">
              <button
                onClick={() => { setIsAddingRoot(true); setNewRootType('part'); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-900 hover:text-violet-400 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{t('manuscript.newPart')}</span>
              </button>
            </div>

            <div ref={treeRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5" onScroll={e => {
              setTreeScrollPosition(e.currentTarget.scrollTop);
              scheduleWorkspaceSave();
            }}>
              {rootNodes.map(node => renderNode(node))}

              {rootNodes.length === 0 && !isAddingRoot && (
                <div className="text-center py-8 px-4 text-xs text-slate-600">
                  {t('manuscript.empty') || 'Manuscrito vacío'}
                </div>
              )}

              {isAddingRoot && (
                <form onSubmit={handleAddRoot} className="p-3 bg-slate-900/40 rounded-xl border border-slate-900 flex flex-col gap-2 mt-2">
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newRootTitle}
                    onChange={e => setNewRootTitle(e.target.value)}
                    placeholder="Título del nodo..."
                    className="bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
                  />
                  <div className="flex justify-between items-center">
                    <select value={newRootType} onChange={e => setNewRootType(e.target.value as any)} className="bg-slate-950 border border-slate-850 rounded text-xs text-slate-400 px-2 py-1 outline-none">
                      <option value="part">Parte</option>
                      <option value="folder">Carpeta</option>
                    </select>
                    <div className="flex gap-2 text-xs">
                      <button type="button" onClick={() => setIsAddingRoot(false)} className="text-slate-500 hover:text-slate-300">{t('common.cancel')}</button>
                      <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-2.5 py-1 rounded">{t('common.create')}</button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/10">
        {renderMainContent()}
      </div>
    </div>
  );
};
