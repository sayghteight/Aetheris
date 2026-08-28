import React from 'react';
import { Table as TableIcon } from 'lucide-react';
import type { UniverseBlock, BlockContent } from '../../types';
import { useI18n } from '../../../../i18n';

interface TableBlockProps {
  block: UniverseBlock;
  onUpdate: (content: BlockContent) => void;
  isEditing: boolean;
}

export const TableBlock: React.FC<TableBlockProps> = ({ block, onUpdate, isEditing }) => {
  const { t } = useI18n();
  const content = block.content as {
    type: 'table';
    headers: string[];
    rows: string[][];
  };

  if (!isEditing) {
    if (content.headers.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 py-8 text-center">
          <div className="text-slate-500">
            <TableIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t('universe.blocks.noData')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              {content.headers.map((header, idx) => (
                <th key={idx} className="px-3 py-2 text-left font-medium text-slate-400">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-800/50">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-3 py-2 text-slate-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const updateHeader = (idx: number, value: string) => {
    const newHeaders = [...content.headers];
    newHeaders[idx] = value;
    onUpdate({ ...content, headers: newHeaders });
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
    const newRows = [...content.rows];
    newRows[rowIdx] = [...newRows[rowIdx]];
    newRows[rowIdx][cellIdx] = value;
    onUpdate({ ...content, rows: newRows });
  };

  const addColumn = () => {
    onUpdate({
      ...content,
      headers: [...content.headers, `Columna ${content.headers.length + 1}`],
      rows: content.rows.map((row) => [...row, '']),
    });
  };

  const removeColumn = (idx: number) => {
    onUpdate({
      ...content,
      headers: content.headers.filter((_, i) => i !== idx),
      rows: content.rows.map((row) => row.filter((_, i) => i !== idx)),
    });
  };

  const addRow = () => {
    onUpdate({
      ...content,
      rows: [...content.rows, content.headers.map(() => '')],
    });
  };

  const removeRow = (idx: number) => {
    onUpdate({ ...content, rows: content.rows.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableIcon className="h-5 w-5 text-slate-500" />
          <span className="text-sm text-slate-400">{t('universe.blocks.table')}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={addColumn} className="text-xs text-violet-400 hover:text-violet-300">
            + Columna
          </button>
          <button onClick={addRow} className="text-xs text-violet-400 hover:text-violet-300">
            + Fila
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              {content.headers.map((header, idx) => (
                <th key={idx} className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(idx, e.target.value)}
                      className="w-full rounded border border-slate-700/50 bg-slate-800/50 px-2 py-1 text-xs text-slate-300 outline-none focus:border-violet-500/50"
                    />
                    <button
                      onClick={() => removeColumn(idx)}
                      className="text-slate-600 hover:text-red-400 text-xs"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-slate-800/50">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-2 py-1">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, cellIdx, e.target.value)}
                      className="w-full rounded border border-slate-700/50 bg-slate-800/30 px-2 py-1 text-xs text-slate-300 outline-none focus:border-violet-500/50"
                    />
                  </td>
                ))}
                <td className="w-8">
                  <button
                    onClick={() => removeRow(rowIdx)}
                    className="text-slate-600 hover:text-red-400 text-xs"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableBlock;
