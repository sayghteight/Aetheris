import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Tab } from './Tab';
import { useTabStore, TabType } from '../../store/tabStore';

interface TabBarProps {
  onOpenMainView?: (view: TabType) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ onOpenMainView }) => {
  const { t } = useI18n();
  const {
    tabs,
    activeTabId,
    recentlyClosedTabs,
    setActiveTab,
    closeTab,
    reorderTabs,
    reopenLastClosedTab,
  } = useTabStore();

  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabBarRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTabId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+W - close active tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        const { closeActiveTab } = useTabStore.getState();
        closeActiveTab();
      }
      // Ctrl+Shift+T - reopen last closed tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        reopenLastClosedTab();
      }
      // Ctrl+Tab - next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTab(tabs[nextIndex].id);
        }
      }
      // Ctrl+Shift+Tab - previous tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, setActiveTab, reopenLastClosedTab]);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab]
  );

  const handleMiddleMouseClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(tabId);
      }
    },
    [closeTab]
  );

  // Drag & Drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear dragOverIndex if we're leaving the tab bar entirely
    const relatedTarget = e.relatedTarget as Node | null;
    if (!tabBarRef.current?.contains(relatedTarget)) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        reorderTabs(draggedIndex, dropIndex);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, reorderTabs]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden"
      style={{ height: '40px' }}
    >
      {/* Tabs container */}
      <div
        ref={tabBarRef}
        className="flex items-center flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--color-border)] scrollbar-track-transparent"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            ref={tab.id === activeTabId ? activeTabRef : null}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => handleMiddleMouseClick(e, tab.id)}
            className={`
              relative transition-all duration-150
              ${draggedIndex === index ? 'opacity-50' : ''}
              ${dragOverIndex === index && draggedIndex !== null ? 'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-amber-500 before:rounded-full' : ''}
            `}
          >
            <Tab
              id={tab.id}
              type={tab.type}
              title={tab.title}
              isActive={tab.id === activeTabId}
              isModified={tab.isModified}
              onClick={() => setActiveTab(tab.id)}
              onClose={(e) => handleCloseTab(e, tab.id)}
            />
          </div>
        ))}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1 px-2 shrink-0">
        {/* Reopen closed tab */}
        {recentlyClosedTabs.length > 0 && (
          <button
            onClick={reopenLastClosedTab}
            className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title="Reopen last closed tab (Ctrl+Shift+T)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* New tab button */}
        {onOpenMainView && (
          <button
            onClick={() => onOpenMainView('manuscript')}
            className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            title={t('ui.newTab')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default TabBar;
