import React, { useEffect, useRef } from 'react';
import { FileText, Plus, Trash2, SplitSquareHorizontal, Combine } from 'lucide-react';

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onAction: (id: string) => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onAction, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[180px] overflow-hidden"
      style={{ left: x, top: y }}
    >
      {actions.map((action, index) => {
        if (action.separator) {
          return <div key={`sep-${index}`} className="h-px bg-slate-700 my-1" />;
        }

        return (
          <button
            key={action.id}
            disabled={action.disabled}
            onClick={() => !action.disabled && onAction(action.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              action.disabled
                ? 'text-slate-600 cursor-not-allowed'
                : action.danger
                ? 'text-red-400 hover:bg-red-900/40'
                : 'text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {action.icon && <span className="w-4 h-4">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Helper to build merge actions
export const buildMergeActions = (
  selectedCount: number,
  hasScenesSelected: boolean,
  labels: { merge: string; split: string; addChild: string; rename: string; delete: string }
): ContextMenuAction[] => {
  const actions: ContextMenuAction[] = [];

  if (selectedCount >= 2 && hasScenesSelected) {
    actions.push({
      id: 'merge',
      label: labels.merge,
      icon: <Combine className="w-4 h-4" />,
    });
  }

  if (selectedCount === 1) {
    actions.push({
      id: 'split',
      label: labels.split,
      icon: <SplitSquareHorizontal className="w-4 h-4" />,
    });
    actions.push({ id: 'separator-1', label: '', separator: true });
    actions.push({
      id: 'addChild',
      label: labels.addChild,
      icon: <Plus className="w-4 h-4" />,
    });
  }

  if (selectedCount >= 1) {
    actions.push({ id: 'separator-2', label: '', separator: true });
    actions.push({
      id: 'rename',
      label: labels.rename,
      icon: <FileText className="w-4 h-4" />,
    });
    actions.push({
      id: 'delete',
      label: labels.delete,
      icon: <Trash2 className="w-4 h-4" />,
      danger: true,
    });
  }

  return actions;
};
