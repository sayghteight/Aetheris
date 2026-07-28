import React, { useEffect, useState, useRef } from 'react';
import { useManuscriptStore, ManuscriptNode } from '../../store/manuscriptStore';
import { useNavigationStore } from '../../store/navigationStore';
import { useWorkspaceStore, scheduleWorkspaceSave } from '../../store/workspaceStore';
import { 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  Folder, 
  FileText,
  Plus,
  PlusCircle
} from 'lucide-react';

export const ManuscriptTree: React.FC = () => {
  const { nodes, fetchNodes, createNode } = useManuscriptStore();
  const { setActiveSceneId, selectedNodeId, setSelectedNodeId } = useNavigationStore();
  const { expandedNodeIds, setExpandedNodeIds, treeScrollPosition, setTreeScrollPosition, isLoaded } = useWorkspaceStore();

  const treeRef = useRef<HTMLDivElement>(null);
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newRootTitle, setNewRootTitle] = useState('');
  const [newRootType, setNewRootType] = useState<'part' | 'chapter' | 'scene' | 'folder'>('part');

  // Agregar subnodo
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [newChildType, setNewChildType] = useState<'part' | 'chapter' | 'scene' | 'folder'>('scene');

  // Convert array to Record for existing toggle logic
  const expandedNodes = expandedNodeIds.reduce((acc, id) => ({ ...acc, [id]: true }), {} as Record<string, boolean>);

  useEffect(() => {
    fetchNodes();
  }, []);

  // Restore scroll position after state is loaded
  useEffect(() => {
    if (isLoaded && treeScrollPosition > 0 && treeRef.current) {
      requestAnimationFrame(() => {
        if (treeRef.current) treeRef.current.scrollTop = treeScrollPosition;
      });
    }
  }, [isLoaded, treeScrollPosition]);

  const toggleExpand = (id: string) => {
    const newIds = expandedNodes[id]
      ? expandedNodeIds.filter(nid => nid !== id)
      : [...expandedNodeIds, id];
    setExpandedNodeIds(newIds);
    scheduleWorkspaceSave();
  };

  const handleAddRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootTitle.trim()) return;
    try {
      await createNode(null, newRootTitle.trim(), newRootType);
      setNewRootTitle('');
      setIsAddingRoot(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddChild = async (parentId: string) => {
    if (!newChildTitle.trim()) return;
    try {
      const created = await createNode(parentId, newChildTitle.trim(), newChildType);
      // Auto expandir
      if (!expandedNodeIds.includes(parentId)) {
        setExpandedNodeIds([...expandedNodeIds, parentId]);
      }
      setNewChildTitle('');
      setAddingChildTo(null);
      setSelectedNodeId(created.id);
      if (newChildType === 'scene') {
        setActiveSceneId(created.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Agrupar jerárquicamente
  const rootNodes = nodes.filter(n => !n.parent_id);
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId);

  const renderNode = (node: ManuscriptNode, depth: number = 0) => {
    const children = getChildren(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const isActive = selectedNodeId === node.id;

    // Selector de icono
    let Icon = FileText;
    let iconColor = 'text-slate-400';
    if (node.type === 'part') {
      Icon = BookOpen;
      iconColor = 'text-violet-400';
    } else if (node.type === 'chapter' || node.type === 'folder') {
      Icon = Folder;
      iconColor = 'text-amber-400';
    }

    return (
      <div key={node.id} className="select-none">
        {/* Node Row */}
        <div 
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg cursor-pointer transition-all duration-150 ${
            isActive 
              ? 'bg-violet-600/20 border-l-2 border-violet-500 text-violet-200' 
              : 'hover:bg-slate-900/60 text-slate-300'
          }`}
          onClick={() => {
            setSelectedNodeId(node.id);
            if (node.type === 'scene') {
              setActiveSceneId(node.id);
            }
          }}
        >
          <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            {/* Expand Arrow */}
            {node.type !== 'scene' ? (
              <span onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }} className="p-0.5 hover:bg-slate-800 rounded text-slate-500">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-4.5" />
            )}
            
            <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
            <span className="text-sm truncate font-medium">{node.title}</span>
          </div>

          {/* Quick Action buttons */}
          {node.type !== 'scene' && (
            <div className="hidden group-hover:flex items-center gap-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingChildTo(node.id);
                  setNewChildType(node.type === 'part' ? 'chapter' : 'scene');
                }}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                title="Añadir Elemento"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Adding Child Input Form */}
        {addingChildTo === node.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }} className="py-2 pr-2">
            <div className="flex flex-col gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-900">
              <input
                type="text"
                autoFocus
                value={newChildTitle}
                onChange={(e) => setNewChildTitle(e.target.value)}
                placeholder="Título del elemento..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded px-2 py-1 text-xs outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddChild(node.id);
                  if (e.key === 'Escape') setAddingChildTo(null);
                }}
              />
              <div className="flex justify-between items-center gap-2">
                <select 
                  value={newChildType}
                  onChange={(e) => setNewChildType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-850 rounded text-[10px] text-slate-350 px-1 py-0.5 outline-none"
                >
                  <option value="scene">Escena</option>
                  <option value="chapter">Capítulo</option>
                  <option value="folder">Carpeta</option>
                </select>
                <div className="flex gap-1.5">
                  <button onClick={() => setAddingChildTo(null)} className="text-[10px] text-slate-500 hover:text-slate-300">
                    Cancelar
                  </button>
                  <button onClick={() => handleAddChild(node.id)} className="text-[10px] bg-violet-600 hover:bg-violet-500 text-white px-2 py-0.5 rounded font-semibold">
                    Crear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Children Render */}
        {node.type !== 'scene' && isExpanded && hasChildren && (
          <div className="mt-0.5">
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-slate-900 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Manuscrito
        </h2>
        <button 
          onClick={() => {
            setIsAddingRoot(true);
            setNewRootType('part');
          }}
          className="p-1 hover:bg-slate-900 text-slate-400 hover:text-violet-400 rounded transition-colors"
          title="Nueva Parte / Nodo Raíz"
        >
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Manuscript Nodes List */}
      <div ref={treeRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-1" onScroll={(e) => {
        setTreeScrollPosition(e.currentTarget.scrollTop);
        scheduleWorkspaceSave();
      }}>
        {rootNodes.map(node => renderNode(node))}

        {rootNodes.length === 0 && !isAddingRoot && (
          <div className="text-center py-8 px-4 text-xs text-slate-600">
            El manuscrito está vacío. Crea una nueva Parte para comenzar.
          </div>
        )}

        {/* Adding Root Node Input Form */}
        {isAddingRoot && (
          <form onSubmit={handleAddRoot} className="p-3 bg-slate-900/40 rounded-xl border border-slate-900 flex flex-col gap-2 mt-2">
            <input
              type="text"
              autoFocus
              required
              value={newRootTitle}
              onChange={(e) => setNewRootTitle(e.target.value)}
              placeholder="Título del nodo..."
              className="bg-slate-950 border border-slate-800 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
            />
            <div className="flex justify-between items-center">
              <select 
                value={newRootType}
                onChange={(e) => setNewRootType(e.target.value as any)}
                className="bg-slate-950 border border-slate-850 rounded text-xs text-slate-400 px-2 py-1 outline-none"
              >
                <option value="part">Parte</option>
                <option value="folder">Carpeta</option>
                <option value="scene">Escena</option>
              </select>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setIsAddingRoot(false)} className="text-slate-500 hover:text-slate-300">
                  Cancelar
                </button>
                <button type="submit" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-2.5 py-1 rounded">
                  Añadir
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
