import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  User,
  MapPin,
  Users,
  Crown,
  PawPrint,
  Gem,
  Calendar,
  Lightbulb,
  FileText,
  Check,
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import { useI18n } from '../../../../i18n';
import type { EntryType, LayoutType, EntryWizardData } from '../../types';
import { getEntryTypeColor } from '../../types';

// ─── Entry Type Configuration ──────────────────────────────────────────────────

const entryTypeConfig: Array<{
  id: EntryType;
  nameEs: string;
  nameEn: string;
  icon: React.ComponentType<{ className?: string; color?: string }>;
}> = [
  { id: 'character', nameEs: 'Personaje', nameEn: 'Character', icon: User },
  { id: 'location', nameEs: 'Lugar', nameEn: 'Location', icon: MapPin },
  { id: 'faction', nameEs: 'Facción', nameEn: 'Faction', icon: Users },
  { id: 'kingdom', nameEs: 'Reino', nameEn: 'Kingdom', icon: Crown },
  { id: 'creature', nameEs: 'Criatura', nameEn: 'Creature', icon: PawPrint },
  { id: 'item', nameEs: 'Objeto', nameEn: 'Item', icon: Gem },
  { id: 'event', nameEs: 'Evento', nameEn: 'Event', icon: Calendar },
  { id: 'concept', nameEs: 'Concepto', nameEn: 'Concept', icon: Lightbulb },
  { id: 'other', nameEs: 'Otro', nameEn: 'Other', icon: FileText },
];

// ─── Layout Options ────────────────────────────────────────────────────────────

const layoutOptions: Array<{ id: LayoutType; labelEs: string; labelEn: string; cols: number }> = [
  { id: '1-col', labelEs: 'Una columna', labelEn: 'One column', cols: 1 },
  { id: '2-col', labelEs: 'Dos columnas', labelEn: 'Two columns', cols: 2 },
  { id: '3-col', labelEs: 'Tres columnas', labelEn: 'Three columns', cols: 3 },
];

// ─── EntryWizard ───────────────────────────────────────────────────────────────

interface EntryWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (entryId: string) => void;
  preselectedCategoryId?: string | null;
}

export const EntryWizard: React.FC<EntryWizardProps> = ({
  isOpen,
  onClose,
  onCreated,
  preselectedCategoryId,
}) => {
  const { t, language } = useI18n();
  const { categories, createEntry } = useUniverseStore();
  const isSpanish = language === 'es';
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<EntryType>('character');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('1-col');
  const [isCreating, setIsCreating] = useState(false);

  // Initialize category when wizard opens
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedCategoryId) {
        setSelectedCategory(preselectedCategoryId);
      } else if (!selectedCategory && categories.length > 0) {
        setSelectedCategory(categories[0].id);
      }
    }
  }, [isOpen, preselectedCategoryId, categories]);

  const resetForm = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSelectedType('character');
    setSelectedCategory(preselectedCategoryId || categories[0]?.id || '');
    setSelectedLayout('1-col');
    setIsCreating(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canProceedStep1 = name.trim().length > 0 && selectedCategory;
  const canProceedStep2 = true;

  const handleNext = () => {
    if (step === 1 && canProceedStep1) setStep(2);
    else if (step === 2 && canProceedStep2) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    if (!name.trim() || !selectedCategory) return;

    setIsCreating(true);
    try {
      const data: EntryWizardData = {
        name: name.trim(),
        type: selectedType,
        description: description.trim(),
        categoryId: selectedCategory,
      };
      console.log('Creating entry with data:', data);
      const entry = await createEntry(data, selectedLayout);
      console.log('Entry created:', entry);
      resetForm();
      onCreated(entry.id);
    } catch (error) {
      console.error('Error creating entry:', error);
      alert(t('universe.wizard.errorCreatingEntry') + ': ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl border border-slate-800/80 bg-slate-900/95 shadow-2xl shadow-slate-950/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-900/50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('universe.wizard.title')}</h2>
            <p className="text-xs text-slate-500">{t('universe.wizard.step', { step, max: 3 })}</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('universe.wizard.nameRequired')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('universe.wizard.namePlaceholder')}
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('universe.wizard.entryType')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {entryTypeConfig.map((type) => {
                    const Icon = type.icon;
                    const color = getEntryTypeColor(type.id);
                    const isSelected = selectedType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                          isSelected
                            ? 'border-violet-500/50 bg-violet-500/10'
                            : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                        }`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg border"
                          style={{
                            borderColor: isSelected ? color : 'transparent',
                            backgroundColor: `${color}15`,
                          }}
                        >
                          <Icon className="h-5 w-5" color={color} />
                        </div>
                        <span className="text-xs font-medium text-slate-300">{isSpanish ? type.nameEs : type.nameEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('universe.wizard.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('universe.wizard.descriptionPlaceholder')}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 resize-none"
                />
              </div>

              {!preselectedCategoryId && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {t('universe.wizard.categoryRequired')}
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                  >
                    <option value="">{t('universe.wizard.selectCategory')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {preselectedCategoryId && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                  <p className="text-sm text-slate-400">
                    {t('universe.wizard.categoryLabel')} <span className="text-slate-200">{categories.find(c => c.id === preselectedCategoryId)?.name}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Layout Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">{t('universe.wizard.pageDesign')}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {t('universe.wizard.pageDesignSubtitle')}
                </p>
              </div>

              <div className="grid gap-4">
                {layoutOptions.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedLayout(layout.id)}
                    className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${
                      selectedLayout === layout.id
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex gap-1">
                      {Array.from({ length: layout.cols }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-16 rounded border-2 transition ${
                            selectedLayout === layout.id
                              ? 'border-violet-500/50 bg-violet-500/10'
                              : 'border-slate-600/50 bg-slate-700/30'
                          }`}
                          style={{ width: `${120 / layout.cols}px` }}
                        />
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-slate-200">{isSpanish ? layout.labelEs : layout.labelEn}</p>
                      <p className="text-xs text-slate-500">
                        {layout.cols === 1
                          ? t('universe.wizard.layout1ColDesc')
                          : layout.cols === 2
                          ? t('universe.wizard.layout2ColDesc')
                          : t('universe.wizard.layout3ColDesc')}
                      </p>
                    </div>
                    {selectedLayout === layout.id && (
                      <div className="ml-auto">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <h4 className="text-xs font-medium text-slate-400 mb-2">{t('universe.wizard.tip')}</h4>
                <p className="text-xs text-slate-500">
                  {selectedLayout === '1-col' && t('universe.wizard.tip1Col')}
                  {selectedLayout === '2-col' && t('universe.wizard.tip2Col')}
                  {selectedLayout === '3-col' && t('universe.wizard.tip3Col')}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Summary */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: `${getEntryTypeColor(selectedType)}40`,
                      backgroundColor: `${getEntryTypeColor(selectedType)}10`,
                    }}
                  >
                    {React.createElement(
                      entryTypeConfig.find((t) => t.id === selectedType)?.icon || FileText,
                      { className: 'h-6 w-6', color: getEntryTypeColor(selectedType) }
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{name || t('universe.wizard.untitled')}</h3>
                    <p className="text-sm text-slate-400">
                      {isSpanish
                        ? entryTypeConfig.find((t) => t.id === selectedType)?.nameEs
                        : entryTypeConfig.find((t) => t.id === selectedType)?.nameEn} •{' '}
                      {categories.find((c) => c.id === selectedCategory)?.name}
                    </p>
                  </div>
                </div>
                {description && (
                  <p className="mt-4 text-sm text-slate-400">{description}</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-slate-500">{t('universe.wizard.layout')}:</span>
                  <span className="text-xs font-medium text-slate-300">
                    {isSpanish
                      ? layoutOptions.find((l) => l.id === selectedLayout)?.labelEs
                      : layoutOptions.find((l) => l.id === selectedLayout)?.labelEn}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs text-amber-300">
                  {t('universe.wizard.autoTextBlockAdvice')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/60 bg-slate-900/50 px-6 py-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200 disabled:opacity-40 disabled:hover:text-slate-400"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('universe.wizard.back')}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              className="flex items-center gap-1 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600"
            >
              {t('universe.wizard.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!name.trim() || !selectedCategory || isCreating}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600"
            >
              {isCreating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t('universe.wizard.creating')}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {t('universe.wizard.createEntry')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryWizard;
