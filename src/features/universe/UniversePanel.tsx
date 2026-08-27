import React, { useEffect, useState } from 'react';
import { useUniverseStore } from './store/universeStore';
import { useNavigationStore } from '../../store/navigationStore';
import { UniverseIndex } from './components/index/UniverseIndex';
import { CategoryView } from './components/category/CategoryView';
import { EntryWizard } from './components/wizard/EntryWizard';
import { UniverseEntryView } from './components/entry/UniverseEntryView';

// ─── Main Universe Panel ───────────────────────────────────────────────────────

export const UniversePanel: React.FC = () => {
  const { viewState, setView, selectEntry, selectCategory, loadUniverse, entries } = useUniverseStore();
  const { selectedUniverseEntryId, selectedUniverseCategoryId, setSelectedUniverse } = useNavigationStore();

  const [showWizard, setShowWizard] = useState(false);

  // Load universe data on mount
  useEffect(() => {
    loadUniverse();
  }, [loadUniverse]);

  // Sync with navigation store (for search navigation)
  useEffect(() => {
    if (!selectedUniverseEntryId) return;

    // Find the entry in our store
    const entry = entries.find(e => e.id === selectedUniverseEntryId);
    if (entry) {
      selectEntry(entry.id);
      if (selectedUniverseCategoryId) {
        selectCategory(selectedUniverseCategoryId);
      }
      setView('entry');
      // Clear navigation state so repeated searches work
      setSelectedUniverse(null, null);
    }
  }, [selectedUniverseEntryId, selectedUniverseCategoryId, entries, selectEntry, selectCategory, setView, setSelectedUniverse]);

  // Handle category selection - go to category view
  const handleSelectCategory = (categoryId: string) => {
    selectCategory(categoryId);
    setView('category');
  };

  // Handle entry selection - go to entry view
  const handleSelectEntry = (entryId: string) => {
    selectEntry(entryId);
    setView('entry');
  };

  // Handle back to categories
  const handleBackToCategories = () => {
    selectCategory(null);
    setView('index');
  };

  // Handle back to category (from entry view)
  const handleBackToCategory = () => {
    selectEntry(null);
    setView('category');
  };

  // Handle entry created
  const handleEntryCreated = (entryId: string) => {
    setShowWizard(false);
    selectEntry(entryId);
    setView('entry');
  };

  // Render based on view state
  if (viewState.mode === 'entry' && viewState.selectedEntryId) {
    return (
      <div className="flex h-full flex-col">
        <UniverseEntryView
          entryId={viewState.selectedEntryId}
          onBack={handleBackToCategory}
        />
      </div>
    );
  }

  if (viewState.mode === 'category' && viewState.selectedCategoryId) {
    return (
      <div className="flex h-full flex-col">
        <CategoryView
          categoryId={viewState.selectedCategoryId}
          onSelectEntry={handleSelectEntry}
          onBack={handleBackToCategories}
          onCreateEntry={() => setShowWizard(true)}
        />
        <EntryWizard
          isOpen={showWizard}
          onClose={() => setShowWizard(false)}
          onCreated={handleEntryCreated}
          preselectedCategoryId={viewState.selectedCategoryId}
        />
      </div>
    );
  }

  // Default: categories index view
  return (
    <div className="flex h-full flex-col">
      <UniverseIndex
        onSelectCategory={handleSelectCategory}
        onCreateEntry={() => setShowWizard(true)}
      />
      <EntryWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleEntryCreated}
      />
    </div>
  );
};

export default UniversePanel;
