import React from 'react';
import type { UniverseBlock, BlockContent } from '../../types';
import { useI18n } from '../../../../i18n';

interface KeyInfoBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const KeyInfoBlock: React.FC<KeyInfoBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as { type: 'key-info'; fields: Array<{ label: string; value: string; icon?: string }> };
  const fields = content.fields || [];

  if (!isEditing) {
    if (fields.length === 0) {
      return <p className="text-sm text-slate-500">{t('universe.blocks.noInfo')}</p>;
    }
    return (
      <div className="grid gap-2">
        {fields.map((field, idx) => (
          <div key={idx} className="flex items-center gap-3">
            {field.icon && <span className="text-sm">{field.icon}</span>}
            <span className="text-xs font-medium text-slate-500">{field.label}:</span>
            <span className="text-sm text-slate-300">{field.value}</span>
          </div>
        ))}
      </div>
    );
  }

  const addField = () => {
    onUpdate({
      type: 'key-info',
      fields: [...fields, { label: '', value: '', icon: '' }],
    });
  };

  const updateField = (idx: number, updates: Partial<{ label: string; value: string; icon: string }>) => {
    const newFields = [...fields];
    newFields[idx] = { ...newFields[idx], ...updates };
    onUpdate({ type: 'key-info', fields: newFields });
  };

  const removeField = (idx: number) => {
    onUpdate({ type: 'key-info', fields: fields.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{t('universe.blocks.keyInfo')}</span>
        <button
          onClick={addField}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          + {t('universe.blocks.addFields')}
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="text-sm text-slate-500">{t('universe.blocks.addFields')}</p>
      ) : (
        fields.map((field, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={field.icon || ''}
              onChange={(e) => updateField(idx, { icon: e.target.value })}
              placeholder="Icono"
              className="w-12 rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 outline-none focus:border-violet-500/50"
            />
            <input
              type="text"
              value={field.label}
              onChange={(e) => updateField(idx, { label: e.target.value })}
              placeholder="Campo"
              className="w-24 rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 outline-none focus:border-violet-500/50"
            />
            <span className="text-slate-600">:</span>
            <input
              type="text"
              value={field.value}
              onChange={(e) => updateField(idx, { value: e.target.value })}
              placeholder="Valor"
              className="flex-1 rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => removeField(idx)}
              className="text-slate-600 hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default KeyInfoBlock;
