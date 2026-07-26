import React, { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Upload, FileText, Folder, Layers3, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useManuscriptStore } from '../../store/manuscriptStore';
import { useI18n } from '../../i18n';
import { parseDocx, PartImport } from '../../utils/docxParser';

export const WordImportPanel: React.FC = () => {
  const { t } = useI18n();
  const { setActiveView } = useWorkspaceStore();
  const { createNode } = useManuscriptStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedDoc, setParsedDoc] = useState<PartImport[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState<string>('');
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setImportResult({ success: false, message: t('import.onlyDocx') });
      return;
    }
    setFileName(file.name);
    try {
      const result = await parseDocx(file);
      setParsedDoc(result);
      setImportResult(null);
    } catch {
      setImportResult({ success: false, message: t('import.invalidFile') });
      setParsedDoc(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (!parsedDoc) return;
    setIsImporting(true);
    setImportResult(null);
    setImportProgress(0);

    const totalItems = parsedDoc.reduce((acc, p) => acc + p.chapters.reduce((a, c) => a + c.scenes.length, 0), 0);
    let processedItems = 0;

    try {
      for (const part of parsedDoc) {
        setCurrentItem(`${t('import.creatingPart')}: ${part.title}`);
        const partNode = await createNode(null, part.title, 'part');
        for (const chapter of part.chapters) {
          setCurrentItem(`${t('import.creatingChapter')}: ${chapter.title}`);
          const chapterNode = await createNode(partNode.id, chapter.title, 'chapter');
          for (const scene of chapter.scenes) {
            setCurrentItem(`${t('import.importingScene')}: ${scene.title}`);
            const sceneNode = await createNode(chapterNode.id, scene.title, 'scene');
            await invoke('update_scene_content', {
              nodeId: sceneNode.id,
              content: scene.content,
              plainText: scene.content.replace(/<[^>]+>/g, ' ').trim(),
            });
            processedItems++;
            setImportProgress(Math.round((processedItems / totalItems) * 100));
          }
        }
      }
      setImportResult({ success: true, message: `${t('import.success')} ${totalItems} ${t('import.scenesCreated')}` });
      setParsedDoc(null);
      setFileName(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('import.error');
      setImportResult({ success: false, message });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setCurrentItem('');
    }
  };

  const handleCancel = () => {
    setParsedDoc(null);
    setFileName(null);
    setImportResult(null);
  };

  const totalScenes = parsedDoc
    ? parsedDoc.reduce((acc, p) => acc + p.chapters.reduce((a, c) => a + c.scenes.length, 0), 0)
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveView('manuscript')}
          disabled={isImporting}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('import.back')}
        </button>
        <div className="h-4 w-px bg-slate-800" />
        <div>
          <h2 className="text-xl font-bold text-white">{t('import.title')}</h2>
          <p className="text-sm text-slate-400">
            {isImporting ? t('import.titleProgress') : t('import.subtitle')}
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {!parsedDoc && !isImporting && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
            dragOver
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
          }`}
        >
          <Upload className={`w-10 h-10 mx-auto mb-4 ${dragOver ? 'text-violet-400' : 'text-slate-500'}`} />
          <p className="text-white font-medium">{t('import.dropzone')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('import.dropzoneHint')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {parsedDoc && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 overflow-hidden">
          <div className="p-4 border-b border-slate-800/70 bg-slate-900/30">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              {fileName}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {parsedDoc.length} {t('import.parts')} · {totalScenes} {t('import.scenes')}
            </p>
          </div>

          <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
            {parsedDoc.map((part, pi) => (
              <div key={pi} className="rounded-xl border border-slate-800/60 bg-slate-950/40 overflow-hidden">
                {/* Parte */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-950/20 border-b border-slate-800/50">
                  <Layers3 className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-sm font-semibold text-violet-200">{part.title}</span>
                </div>
                {part.chapters.map((chapter, ci) => (
                  <div key={ci} className="border-b border-slate-800/30 last:border-0">
                    {/* Capítulo */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/10 border-b border-slate-800/20">
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-sm font-medium text-amber-200">{chapter.title}</span>
                    </div>
                    {/* Escenas */}
                    {chapter.scenes.map((scene, si) => (
                      <div key={si} className="flex items-start gap-2 px-4 py-2 border-b border-slate-800/10 last:border-0">
                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-300 font-medium truncate">{scene.title}</p>
                          <p className="text-xs text-slate-600 truncate mt-0.5">
                            {scene.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 80)}…
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Acciones */}
          <div className="p-4 border-t border-slate-800/70 flex items-center justify-end gap-3">
            {!isImporting && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {t('import.cancel')}
              </button>
            )}
            <button
              onClick={handleImport}
              disabled={isImporting || totalScenes === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? t('import.importing') : t('import.import')}
            </button>
          </div>

          {/* Progress bar */}
          {isImporting && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{currentItem}</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultado */}
      {importResult && (
        <div
          className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            importResult.success
              ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-300'
              : 'border-red-800/60 bg-red-950/20 text-red-300'
          }`}
        >
          {importResult.success ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <p className="text-sm">{importResult.message}</p>
        </div>
      )}
    </div>
  );
};
