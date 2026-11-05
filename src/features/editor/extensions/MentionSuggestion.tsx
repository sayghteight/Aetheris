import React, { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import { User, MapPin, Users, Gem, Calendar } from 'lucide-react';

export interface MentionSuggestionItem {
  id: string;
  name: string;
  characterType: string;
  briefDescription?: string | null;
  categoryName?: string;
}

interface MentionSuggestionListProps {
  items: MentionSuggestionItem[];
  command: (item: MentionSuggestionItem) => void;
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  race: User,
  location: MapPin,
  faction: Users,
  organization: Users,
  kingdom: Users,
  item: Gem,
  event: Calendar,
};

const ENTITY_COLORS: Record<string, string> = {
  character: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  race: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  location: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  faction: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  organization: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  kingdom: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  item: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  event: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

export interface MentionSuggestionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionSuggestionList = forwardRef<MentionSuggestionListRef, MentionSuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = useCallback((index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    }, [items, command]);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + items.length - 1) % Math.max(items.length, 1));
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % Math.max(items.length, 1));
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        if (event.key === 'Escape') {
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center py-4 text-sm text-[var(--color-text-muted)]">
          No se encontraron entidades
        </div>
      );
    }

    return (
      <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden max-h-[240px] overflow-y-auto">
        {items.map((item, index) => {
          const Icon = ENTITY_ICONS[item.characterType] || User;
          const colorClass = ENTITY_COLORS[item.characterType] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';

          return (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                index === selectedIndex
                  ? 'bg-violet-500/15 text-[var(--color-text-primary)]'
                  : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
              }`}
              onClick={() => selectItem(index)}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)] capitalize">
                    {item.categoryName || item.characterType}
                  </span>
                </div>
                {item.briefDescription && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                    {item.briefDescription}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

MentionSuggestionList.displayName = 'MentionSuggestionList';

export default MentionSuggestionList;
