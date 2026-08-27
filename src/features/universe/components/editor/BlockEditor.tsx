import React, { useState } from 'react';
import {
  Plus,
  GripVertical,
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import type { UniverseBlock, LayoutType, BlockType, BlockContent } from '../../types';
import {
  RichTextBlock,
  DividerBlock,
  KeyInfoBlock,
  QuoteBlock,
  ListBlock,
  ImageBlock,
  GalleryBlock,
  TableBlock,
  RelatedLinksBlock,
  EntryReferenceBlock,
} from '../blocks';

// ─── Block Toolbar ─────────────────────────────────────────────────────────────

interface BlockToolbarProps {
  onDelete: () => void;
}

const BlockToolbar: React.FC<BlockToolbarProps> = () => {
  return (
    <div className="absolute -left-1 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Drag Handle */}
      <div className="flex h-6 w-5 cursor-grab items-center justify-center rounded-l-md bg-violet-600/80 text-white/80">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    </div>
  );
};

// ─── Add Block Menu ─────────────────────────────────────────────────────────────

interface AddBlockMenuProps {
  columnIndex: 0 | 1 | 2;
  onAdd: (blockType: BlockType) => void;
  onClose: () => void;
}

const blockTypes: Array<{ type: BlockType; label: string; icon: string }> = [
  { type: 'rich-text', label: 'Texto enriquecido', icon: 'T' },
  { type: 'image', label: 'Imagen', icon: '🖼' },
  { type: 'gallery', label: 'Galería', icon: '▦' },
  { type: 'list', label: 'Lista', icon: '☰' },
  { type: 'quote', label: 'Cita', icon: '"' },
  { type: 'key-info', label: 'Información clave', icon: 'ⓘ' },
  { type: 'table', label: 'Tabla', icon: '⊞' },
  { type: 'divider', label: 'Separador', icon: '―' },
  { type: 'related-links', label: 'Enlaces relacionados', icon: '🔗' },
  { type: 'entry-reference', label: 'Referencia a entrada', icon: '↗' },
];

const AddBlockMenu: React.FC<AddBlockMenuProps> = ({ columnIndex: _columnIndex, onAdd, onClose }) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="w-64 rounded-xl border border-slate-700/80 bg-slate-900/95 p-2 shadow-xl">
        <div className="mb-1 px-2 py-1 text-xs font-medium text-slate-500">
          Añadir bloque
        </div>
        <div className="space-y-0.5">
          {blockTypes.map((bt) => (
            <button
              key={bt.type}
              onClick={() => {
                onAdd(bt.type);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-xs">
                {bt.icon}
              </span>
              {bt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg px-3 py-2 text-center text-xs text-slate-500 transition hover:bg-slate-800 hover:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

// ─── Column Container ──────────────────────────────────────────────────────────

interface ColumnContainerProps {
  columnIndex: 0 | 1 | 2;
  blocks: UniverseBlock[];
  onAddBlock: (columnIndex: 0 | 1 | 2, blockType: BlockType) => void;
  onUpdateBlock: (blockId: string, content: BlockContent) => void;
  onDeleteBlock: (blockId: string) => void;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  layout: LayoutType;
  isEditing: boolean;
}

const ColumnContainer: React.FC<ColumnContainerProps> = ({
  columnIndex,
  blocks,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
  selectedBlockId,
  onSelectBlock,
  layout,
  isEditing,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Don't Render columns beyond the layout
  if (layout === '1-col' && columnIndex > 0) return null;
  if (layout === '2-col' && columnIndex > 1) return null;

  const handleAddBlock = (blockType: BlockType) => {
    onAddBlock(columnIndex, blockType);
  };

  return (
    <div className="relative flex flex-col">
      {/* Column Content */}
      <div className="min-h-[200px] space-y-3">
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`group relative rounded-xl border bg-slate-900/60 transition ${
              selectedBlockId === block.id
                ? 'border-violet-500/50 ring-1 ring-violet-500/20'
                : 'border-slate-800/60 hover:border-slate-700'
            }`}
            onClick={() => onSelectBlock(block.id)}
          >
            {/* Block Toolbar */}
            {isEditing && (
              <BlockToolbar
                onDelete={() => onDeleteBlock(block.id)}
              />
            )}

            {/* Block Content */}
            <div className="p-4">
              <BlockContent
                block={block}
                onUpdate={(content) => onUpdateBlock(block.id, content)}
                isEditing={isEditing}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add Block Button */}
      {isEditing && (
        <button
          onClick={() => setShowAddMenu(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700/50 py-3 text-sm text-slate-500 transition hover:border-violet-500/50 hover:text-violet-400"
        >
          <Plus className="h-4 w-4" />
          Añadir bloque
        </button>
      )}

      {/* Add Block Menu */}
      {showAddMenu && (
        <AddBlockMenu
          columnIndex={columnIndex}
          onAdd={handleAddBlock}
          onClose={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
};

// ─── Block Content Renderer ────────────────────────────────────────────────────

interface BlockContentProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

const BlockContent: React.FC<BlockContentProps> = ({ block, onUpdate, isEditing }) => {
  console.log('block.blockType:', JSON.stringify(block.blockType), 'length:', block.blockType.length);
  switch (block.blockType) {
    case 'rich-text':
      return <RichTextBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'divider':
      return <DividerBlock />;
    case 'key-info':
      return <KeyInfoBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'quote':
      return <QuoteBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'list':
      return <ListBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'image':
      return <ImageBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'gallery':
      return <GalleryBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'table':
      return <TableBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'related-links':
      return <RelatedLinksBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    case 'entry-reference':
      return <EntryReferenceBlock block={block} onUpdate={onUpdate} isEditing={isEditing} />;
    default:
      return (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 text-center text-sm text-slate-500">
          Bloque tipo: {block.blockType}
        </div>
      );
  }
};

// ─── Layout Selector ───────────────────────────────────────────────────────────

interface LayoutSelectorProps {
  layout: LayoutType;
  onChange: (layout: LayoutType) => void;
}

const LayoutSelector: React.FC<LayoutSelectorProps> = ({ layout, onChange }) => {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/30 p-1">
      <button
        onClick={() => onChange('1-col')}
        className={`flex h-7 w-7 items-center justify-center rounded transition ${
          layout === '1-col' ? 'bg-violet-600/30 text-violet-300' : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Una columna"
      >
        <div className="h-4 w-3 rounded-sm bg-current" />
      </button>
      <button
        onClick={() => onChange('2-col')}
        className={`flex h-7 w-7 items-center justify-center rounded transition ${
          layout === '2-col' ? 'bg-violet-600/30 text-violet-300' : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Dos columnas"
      >
        <div className="flex h-4 w-4 gap-0.5">
          <div className="h-4 flex-1 rounded-sm bg-current" />
          <div className="h-4 flex-1 rounded-sm bg-current opacity-50" />
        </div>
      </button>
      <button
        onClick={() => onChange('3-col')}
        className={`flex h-7 w-7 items-center justify-center rounded transition ${
          layout === '3-col' ? 'bg-violet-600/30 text-violet-300' : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Tres columnas"
      >
        <div className="flex h-4 w-5 gap-px">
          <div className="h-4 flex-1 rounded-sm bg-current opacity-30" />
          <div className="h-4 flex-1 rounded-sm bg-current opacity-60" />
          <div className="h-4 flex-1 rounded-sm bg-current" />
        </div>
      </button>
    </div>
  );
};

// ─── BlockEditor (Main Component) ─────────────────────────────────────────────

interface BlockEditorProps {
  entryId: string;
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
  isEditing: boolean;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  entryId,
  layout,
  onLayoutChange,
  isEditing,
}) => {
  const {
    blocks,
    addBlock,
    updateBlock,
    deleteBlock,
    updateEntry,
    entries,
  } = useUniverseStore();

  const entryBlocks = blocks.get(entryId) || [];
  const entry = entries.find((e) => e.id === entryId);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Group blocks by column
  const getBlocksByColumn = (colIndex: 0 | 1 | 2) => {
    return entryBlocks
      .filter((b) => b.columnIndex === colIndex)
      .sort((a, b) => a.blockOrder - b.blockOrder);
  };

  const handleAddBlock = async (columnIndex: 0 | 1 | 2, blockType: BlockType) => {
    await addBlock(entryId, columnIndex, blockType);
  };

  const handleUpdateBlock = async (blockId: string, content: BlockContent) => {
    await updateBlock(blockId, { content });
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleSave = async () => {
    if (entry) {
      await updateEntry(entry, entryBlocks);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Editor Toolbar */}
      {isEditing && (
        <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-900/50 px-4 py-3">
          <LayoutSelector layout={layout} onChange={onLayoutChange} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {entryBlocks.length} bloques
            </span>
            <button
              onClick={handleSave}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Columns */}
      <div
        className={`flex-1 gap-4 p-4 ${
          layout === '1-col'
            ? 'grid-cols-1'
            : layout === '2-col'
            ? 'grid grid-cols-2'
            : 'grid grid-cols-3'
        }`}
        style={{
          display: layout === '1-col' ? 'block' : 'grid',
        }}
      >
        {/* Column 0 */}
        <div className={layout === '1-col' ? '' : ''}>
          <ColumnContainer
            columnIndex={0}
            blocks={getBlocksByColumn(0)}
            onAddBlock={handleAddBlock}
            onUpdateBlock={handleUpdateBlock}
            onDeleteBlock={handleDeleteBlock}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            layout={layout}
            isEditing={isEditing}
          />
        </div>

        {/* Column 1 */}
        {layout !== '1-col' && (
          <div>
            <ColumnContainer
              columnIndex={1}
              blocks={getBlocksByColumn(1)}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              layout={layout}
              isEditing={isEditing}
            />
          </div>
        )}

        {/* Column 2 */}
        {layout === '3-col' && (
          <div>
            <ColumnContainer
              columnIndex={2}
              blocks={getBlocksByColumn(2)}
              onAddBlock={handleAddBlock}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              layout={layout}
              isEditing={isEditing}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockEditor;
