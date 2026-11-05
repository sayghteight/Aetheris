import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, User, MapPin, Users, Gem, Calendar } from 'lucide-react';

interface MentionTooltipData {
  id: string;
  name: string;
  characterType?: string;
  briefDescription?: string | null;
  categoryName?: string;
}

interface MentionTooltipProps {
  entity: MentionTooltipData;
  anchorRect: DOMRect | null;
  onOpenInWorldbuilding: (entityId: string) => void;
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
  character: 'from-violet-500 to-purple-600',
  race: 'from-violet-500 to-purple-600',
  location: 'from-emerald-500 to-teal-600',
  faction: 'from-amber-500 to-orange-600',
  organization: 'from-amber-500 to-orange-600',
  kingdom: 'from-amber-500 to-orange-600',
  item: 'from-rose-500 to-pink-600',
  event: 'from-indigo-500 to-blue-600',
};

export const MentionTooltip: React.FC<MentionTooltipProps> = ({
  entity,
  anchorRect,
  onOpenInWorldbuilding,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Calculate initial position below the anchor
    let top = anchorRect.bottom + 8;
    let left = anchorRect.left + anchorRect.width / 2;

    // Adjust if tooltip goes off bottom of screen
    if (top + tooltipRect.height > viewportHeight - 20) {
      top = anchorRect.top - tooltipRect.height - 8;
    }

    // Adjust if tooltip goes off right of screen
    if (left + tooltipRect.width / 2 > viewportWidth - 20) {
      left = viewportWidth - tooltipRect.width - 20;
    }

    // Adjust if tooltip goes off left of screen
    if (left - tooltipRect.width / 2 < 20) {
      left = tooltipRect.width / 2 + 20;
    }

    setPosition({ top, left });
  }, [anchorRect]);

  const Icon = ENTITY_ICONS[entity.characterType || 'character'] || User;
  const colorClass = ENTITY_COLORS[entity.characterType || 'character'] || 'from-slate-500 to-slate-600';

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        minWidth: '240px',
        maxWidth: '320px',
        animation: 'tooltipFadeIn 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-[var(--color-border)]">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center text-white font-bold text-sm`}>
          {entity.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {entity.name}
          </h4>
          <span className="text-xs text-[var(--color-text-muted)] capitalize">
            {entity.categoryName || entity.characterType || 'character'}
          </span>
        </div>
        <Icon className={`w-4 h-4 text-[var(--color-text-muted)] shrink-0`} />
      </div>

      {/* Description */}
      {entity.briefDescription && (
        <div className="px-3 py-2 border-b border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
            {entity.briefDescription}
          </p>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={() => onOpenInWorldbuilding(entity.id)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Abrir en Worldbuilding
      </button>

      <style>{`
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default MentionTooltip;
