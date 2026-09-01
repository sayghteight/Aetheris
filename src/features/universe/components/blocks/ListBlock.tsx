import React from 'react';
import { Trash2 } from 'lucide-react';
import type { UniverseBlock, BlockContent } from '../../types';
import { useI18n } from '../../../../i18n';

interface ListBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const ListBlock: React.FC<ListBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as {
    type: 'list';
    style: 'bullet' | 'numbered' | 'checklist';
    items: Array<{ id: string; text: string; checked?: boolean }>
  };
  const items = content.items || [];

  const addItem = () => {
    onUpdate({
      ...content,
      items: [...items, { id: crypto.randomUUID(), text: '', checked: false }],
    });
  };

  const updateItem = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], text };
    onUpdate({ ...content, items: newItems });
  };

  const toggleCheck = (index: number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], checked: !newItems[index].checked };
    onUpdate({ ...content, items: newItems });
  };

  const removeItem = (index: number) => {
    onUpdate({ ...content, items: items.filter((_, i) => i !== index) });
  };

  if (!isEditing) {
    if (items.length === 0) return <p className="text-sm text-slate-500">{t('universe.blocks.noElements')}</p>;

    return (
      <ul className={`space-y-1 ${content.style === 'numbered' ? 'list-decimal pl-5' : 'list-disc pl-5'}`}>
        {items.map((item) => (
          <li
            key={item.id}
            className={`text-sm ${item.checked ? 'text-slate-500 line-through' : 'text-slate-300'}`}
          >
            {item.text || <span className="text-slate-600">{t('universe.blocks.emptyElement')}</span>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button
          onClick={() => onUpdate({ ...content, style: 'bullet' })}
          className={`px-2 py-0.5 rounded ${content.style === 'bullet' ? 'bg-violet-600/30 text-violet-300' : 'hover:bg-slate-800'}`}
        >
          •
        </button>
        <button
          onClick={() => onUpdate({ ...content, style: 'numbered' })}
          className={`px-2 py-0.5 rounded ${content.style === 'numbered' ? 'bg-violet-600/30 text-violet-300' : 'hover:bg-slate-800'}`}
        >
          1.
        </button>
        <button
          onClick={() => onUpdate({ ...content, style: 'checklist' })}
          className={`px-2 py-0.5 rounded ${content.style === 'checklist' ? 'bg-violet-600/30 text-violet-300' : 'hover:bg-slate-800'}`}
        >
          ☑
        </button>
      </div>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2">
            {content.style === 'checklist' && (
              <button
                onClick={() => toggleCheck(idx)}
                className={`h-4 w-4 rounded border flex items-center justify-center text-xs ${
                  item.checked ? 'bg-violet-600/50 border-violet-500/50' : 'border-slate-600'
                }`}
              >
                {item.checked && <span>✓</span>}
              </button>
            )}
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder="Elemento..."
              className="flex-1 rounded border border-slate-700/50 bg-slate-800/30 px-2 py-1 text-sm text-slate-300 outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => removeItem(idx)}
              className="text-slate-600 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addItem}
        className="text-xs text-violet-400 hover:text-violet-300"
      >
        + Añadir elemento
      </button>
    </div>
  );
};

export default ListBlock;
