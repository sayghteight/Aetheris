import React from 'react';
import { useTabStore, TabType } from '../../store/tabStore';
import { ManuscriptView } from '../../features/manuscript/ManuscriptView';
import { UniversePanel } from '../../features/universe/UniversePanel';
import { ProjectSettings } from '../../features/project/ProjectSettings';
import { UpdatePanel } from '../../features/project/UpdatePanel';
import { ChangelogPanel } from '../../features/project/ChangelogPanel';
import { TimelinePanel } from '../../features/project/TimelinePanel';
import { CalendarsPanel } from '../../features/project/CalendarsPanel';
import { WordImportPanel } from '../../features/import/WordImportPanel';
import { ExportPanel } from '../../features/export/ExportPanel';
import { UniverseEntryView } from '../../features/universe/components/entry/UniverseEntryView';

interface TabContentProps {
  wordCount?: number;
  readTime?: number;
  onStatsUpdate?: (words: number, readTime: number) => void;
}

export const TabContent: React.FC<TabContentProps> = ({
  onStatsUpdate,
}) => {
  const { tabs, activeTabId } = useTabStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <p>No tab selected</p>
      </div>
    );
  }

  // Helper to render main view content
  const renderMainView = (type: TabType) => {
    switch (type) {
      case 'manuscript':
        return <ManuscriptView onStatsUpdate={onStatsUpdate} />;
      case 'universe':
        return <UniversePanel />;
      case 'settings':
        return <ProjectSettings />;
      case 'versioning':
        return <ChangelogPanel />;
      case 'about':
        return <UpdatePanel />;
      case 'timeline':
        return <TimelinePanel />;
      case 'calendars':
        return <CalendarsPanel />;
      case 'import':
        return <WordImportPanel />;
      case 'export':
        return <ExportPanel />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            Tab "{type}" is not yet implemented
          </div>
        );
    }
  };

  // Render based on tab type
  switch (activeTab.type) {
    // Universe entry tabs (character, location, scene, chapter, etc.)
    case 'character':
    case 'location':
    case 'faction':
    case 'item':
    case 'event':
    case 'concept':
    case 'other': {
      if (!activeTab.resourceId) {
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            Resource not found
          </div>
        );
      }
      return (
        <UniverseEntryView
          entryId={activeTab.resourceId}
          onBack={() => {
            // Close the tab when navigating back
            const { closeTab } = useTabStore.getState();
            closeTab(activeTab.id);
          }}
        />
      );
    }

    // Scene and chapter tabs from manuscript
    case 'scene':
    case 'chapter': {
      if (!activeTab.resourceId) {
        return (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            Resource not found
          </div>
        );
      }
      // For now, scene/chapter tabs use the existing manuscript view
      // The selected node will be set based on the resourceId
      return <ManuscriptView onStatsUpdate={onStatsUpdate} />;
    }

    // Main view tabs
    default:
      return renderMainView(activeTab.type);
  }
};

export default TabContent;
