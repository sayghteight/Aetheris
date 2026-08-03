import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../i18n';
import { ManuscriptNode } from '../store/manuscriptStore';
import { X, Check, FileText } from 'lucide-react';

interface MergeScenesDialogProps {
  scenes: ManuscriptNode[];
  onConfirm: (mergedContent: string, mergedPlainText: string, keepMetadataFrom: string) => void;
  onCancel: () => void;
}

interface SceneContent {
  id: string;
  title: string;
  content: string;
  plainText: string;
}

export const MergeScenesDialog: React.FC<MergeScenesDialogProps> = ({
  scenes,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  const [contents, setContents] = useState<SceneContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mergedPreview, setMergedPreview] = useState('');

  useEffect(() => {
    const loadContents = async () => {
      setLoading(true);
      const loaded: SceneContent[] = [];
      for (const scene of scenes) {
        try {
          const content = await invoke<string | null>('get_scene_content', { nodeId: scene.id });
          const plainText = content || '';
          loaded.push({
            id: scene.id,
            title: scene.title,
            content: content || '',
            plainText,
          });
        } catch (err) {
          loaded.push({
            id: scene.id,
            title: scene.title,
            content: '',
            plainText: '',
          });
        }
      }
      setContents(loaded);
      setMergedPreview(loaded.map(c => c.plainText).join('\n\n---\n\n'));
      setLoading(false);
    };
    loadContents();
  }, [scenes]);

  const handleConfirm = () => {
    const selected = contents[selectedIndex];
    onConfirm(selected.content, selected.plainText, selected.id);
  };

  const toggleScene = (index: number) => {
    setSelectedIndex(index);
    // Build preview with selected scene first
    const reordered = [...contents];
    const [selectedScene] = reordered.splice(index, 1);
    reordered.unshift(selectedScene);
    setMergedPreview(reordered.map(c => c.plainText).join('\n\n---\n\n'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('manuscript.mergeScenes') || 'Fusionar Escenas'}</h2>
              <p className="text-xs text-slate-400">{t('manuscript.mergeScenesSubtitle') || 'Selecciona qué contenido y metadatos conservar'}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-slate-400">{t('common.loading') || 'Cargando...'}</div>
            </div>
          ) : (
            <>
              {/* Scene Selection */}
              <div className="w-72 border-r border-slate-700 flex flex-col">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t('manuscript.selectSceneToKeep') || 'Escena a conservar'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {t('manuscript.mergeInstructions') || 'Elige qué escena será la principal y qué contenido se usará'}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {contents.map((scene, index) => (
                    <button
                      key={scene.id}
                      onClick={() => toggleScene(index)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                        selectedIndex === index
                          ? 'bg-violet-600/20 border border-violet-500/50'
                          : 'bg-slate-800/50 border border-transparent hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedIndex === index
                            ? 'border-violet-500 bg-violet-500'
                            : 'border-slate-600'
                        }`}>
                          {selectedIndex === index && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-slate-200 truncate">{scene.title}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 ml-6 line-clamp-2">
                        {scene.plainText.slice(0, 100)}...
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t('manuscript.mergePreview') || 'Vista previa de la fusión'}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-4">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {mergedPreview}
                    </pre>
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
            disabled={loading}
            className="px-6 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {t('manuscript.mergeConfirm') || 'Fusionar escenas'}
          </button>
        </div>
      </div>
    </div>
  );
};
