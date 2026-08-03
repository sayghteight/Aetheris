import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../i18n';
import { X, Scissors } from 'lucide-react';

interface SplitSceneDialogProps {
  sceneId: string;
  sceneTitle: string;
  onConfirm: (cursorPosition: number) => void;
  onCancel: () => void;
}

export const SplitSceneDialog: React.FC<SplitSceneDialogProps> = ({
  sceneId,
  sceneTitle,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  const [plainText, setPlainText] = useState('');
  const [splitPosition, setSplitPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadContent = async () => {
      setLoading(true);
      try {
        const content = await invoke<string | null>('get_scene_content', { nodeId: sceneId });
        setPlainText(content || '');
      } catch (err) {
        setPlainText('');
      }
      setLoading(false);
    };
    loadContent();
  }, [sceneId]);

  const handleTextClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }

    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (!range) return;

    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const preText = textNode.textContent?.slice(0, range.startOffset) || '';

    // Calculate position relative to the full text
    // We need to count all text before this text node
    let absolutePos = 0;
    let node: Node | null = (e.target as HTMLElement).closest('.text-content')?.firstChild ?? null;
    while (node && node !== textNode) {
      if (node.textContent) {
        absolutePos += node.textContent.length;
      }
      node = node.nextSibling;
    }
    absolutePos += preText.length;

    setSplitPosition(absolutePos);
  };

  const handleConfirm = () => {
    if (splitPosition !== null) {
      onConfirm(splitPosition);
    }
  };

  const firstPart = splitPosition !== null ? plainText.slice(0, splitPosition) : '';
  const secondPart = splitPosition !== null ? plainText.slice(splitPosition) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('manuscript.splitScene') || 'Dividir Escena'}</h2>
              <p className="text-xs text-slate-400">{sceneTitle}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-6 py-3 border-b border-slate-700 bg-slate-800/30">
          <p className="text-sm text-slate-300">
            {t('manuscript.splitInstruction') || 'Haz clic en el texto donde quieres dividir la escena'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-slate-400">{t('common.loading') || 'Cargando...'}</div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-hidden flex gap-4">
                {/* Clickable Text */}
                <div className="w-1/2 flex flex-col">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    {t('manuscript.sceneContent') || 'Contenido de la escena'}
                  </h3>
                  <div
                    onClick={handleTextClick}
                    className="flex-1 overflow-y-auto bg-slate-950/50 rounded-lg border border-slate-800 p-4 cursor-crosshair select-text"
                  >
                    <div className="text-base text-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-content">
                      {plainText || <span className="text-slate-600 italic">(vacío)</span>}
                    </div>
                  </div>
                  {splitPosition !== null && (
                    <div className="text-xs text-violet-400 mt-2 flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                      {t('manuscript.splitAt') || 'Dividir en posición'} {splitPosition} / {plainText.length}
                    </div>
                  )}
                </div>

                {/* Preview Panels */}
                <div className="w-1/2 flex flex-col gap-4">
                  {/* First Part Preview */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      {t('manuscript.firstPart') || 'Primera parte'} →
                    </h3>
                    <div className="flex-1 overflow-y-auto bg-slate-950/50 rounded-lg border border-slate-800 p-3">
                      <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {firstPart || <span className="text-slate-600 italic">(vacío)</span>}
                      </pre>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {firstPart.split(/\s+/).filter(w => w.length > 0).length} {t('manuscript.words') || 'palabras'}
                    </div>
                  </div>

                  {/* Second Part Preview */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      ← {t('manuscript.secondPart') || 'Segunda parte'}
                    </h3>
                    <div className="flex-1 overflow-y-auto bg-slate-950/50 rounded-lg border border-slate-800 p-3">
                      <pre className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {secondPart || <span className="text-slate-600 italic">(vacío)</span>}
                      </pre>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {secondPart.split(/\s+/).filter(w => w.length > 0).length} {t('manuscript.words') || 'palabras'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={splitPosition === null}
            className="px-6 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('manuscript.splitConfirm') || 'Dividir escena'}
          </button>
        </div>
      </div>
    </div>
  );
};
