import React from 'react';
import { useI18n } from '../i18n';

export type EmptyStateVariant = 'manuscript' | 'manuscript-tree' | 'universe' | 'timeline' | 'calendar' | 'calendars' | 'search' | 'search-no-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  hint?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const ManuscriptIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Book base */}
    <rect x="20" y="30" width="80" height="55" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    {/* Book spine */}
    <rect x="20" y="30" width="12" height="55" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1"/>
    {/* Pages */}
    <rect x="35" y="36" width="60" height="43" rx="2" fill="#0f172a"/>
    <line x1="40" y1="46" x2="88" y2="46" stroke="#334155" strokeWidth="1" strokeLinecap="round"/>
    <line x1="40" y1="52" x2="88" y2="52" stroke="#334155" strokeWidth="1" strokeLinecap="round"/>
    <line x1="40" y1="58" x2="75" y2="58" stroke="#334155" strokeWidth="1" strokeLinecap="round"/>
    <line x1="40" y1="64" x2="82" y2="64" stroke="#334155" strokeWidth="1" strokeLinecap="round"/>
    {/* Decorative corner */}
    <path d="M85 36 L95 36 L95 46" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    {/* Floating elements */}
    <circle cx="95" cy="22" r="4" fill="#6366f1" opacity="0.3"/>
    <circle cx="102" cy="28" r="2" fill="#8b5cf6" opacity="0.4"/>
    <rect x="10" y="20" width="8" height="8" rx="1" fill="#818cf8" opacity="0.2" transform="rotate(15 14 24)"/>
  </svg>
);

const ManuscriptTreeIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Tree trunk */}
    <rect x="56" y="60" width="8" height="30" rx="2" fill="#78350f"/>
    {/* Tree crown */}
    <circle cx="60" cy="50" r="20" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    <circle cx="45" cy="45" r="12" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
    <circle cx="75" cy="45" r="12" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
    <circle cx="60" cy="35" r="12" fill="#1e293b" stroke="#334155" strokeWidth="1"/>
    {/* Leaves/nodes */}
    <circle cx="60" cy="50" r="4" fill="#6366f1"/>
    <circle cx="45" cy="45" r="3" fill="#8b5cf6"/>
    <circle cx="75" cy="45" r="3" fill="#8b5cf6"/>
    <circle cx="60" cy="35" r="3" fill="#8b5cf6"/>
    {/* Root elements */}
    <rect x="40" y="88" width="15" height="6" rx="2" fill="#334155"/>
    <rect x="65" y="88" width="15" height="6" rx="2" fill="#334155"/>
  </svg>
);

const UniverseIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Central compass/compass rose */}
    <circle cx="60" cy="50" r="25" fill="#1e293b" stroke="#6366f1" strokeWidth="1.5"/>
    <circle cx="60" cy="50" r="18" fill="#0f172a" stroke="#4f46e5" strokeWidth="1"/>
    {/* Compass points */}
    <path d="M60 30 L63 50 L60 55 L57 50 Z" fill="#6366f1"/>
    <path d="M60 70 L57 50 L60 45 L63 50 Z" fill="#4f46e5"/>
    <path d="M40 50 L60 47 L65 50 L60 53 Z" fill="#818cf8"/>
    <path d="M80 50 L60 53 L55 50 L60 47 Z" fill="#6366f1" opacity="0.7"/>
    {/* Outer decorative elements */}
    <circle cx="60" cy="50" r="30" stroke="#334155" strokeWidth="1" strokeDasharray="4 4"/>
    {/* Floating stars */}
    <circle cx="25" cy="25" r="2" fill="#fbbf24" opacity="0.6"/>
    <circle cx="95" cy="30" r="1.5" fill="#a78bfa" opacity="0.5"/>
    <circle cx="90" cy="75" r="2" fill="#fbbf24" opacity="0.4"/>
    <circle cx="30" cy="70" r="1.5" fill="#a78bfa" opacity="0.5"/>
    {/* Orbit ring */}
    <ellipse cx="60" cy="50" rx="38" ry="15" stroke="#334155" strokeWidth="1" transform="rotate(-20 60 50)" opacity="0.5"/>
  </svg>
);

const TimelineIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Timeline base line */}
    <line x1="15" y1="50" x2="105" y2="50" stroke="#334155" strokeWidth="2" strokeLinecap="round"/>
    {/* Timeline dots */}
    <circle cx="25" cy="50" r="4" fill="#6366f1"/>
    <circle cx="60" cy="50" r="4" fill="#8b5cf6"/>
    <circle cx="95" cy="50" r="4" fill="#a78bfa"/>
    {/* Connecting vertical lines */}
    <line x1="25" y1="50" x2="25" y2="35" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 2"/>
    <line x1="60" y1="50" x2="60" y2="65" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 2"/>
    <line x1="95" y1="50" x2="95" y2="35" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 2"/>
    {/* Event markers */}
    <rect x="18" y="25" width="14" height="10" rx="2" fill="#1e293b" stroke="#6366f1" strokeWidth="1"/>
    <rect x="53" y="65" width="14" height="10" rx="2" fill="#1e293b" stroke="#8b5cf6" strokeWidth="1"/>
    <rect x="88" y="25" width="14" height="10" rx="2" fill="#1e293b" stroke="#a78bfa" strokeWidth="1"/>
    {/* Decorative elements */}
    <circle cx="15" cy="50" r="2" fill="#475569"/>
    <circle cx="105" cy="50" r="2" fill="#475569"/>
  </svg>
);

const CalendarIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Calendar body */}
    <rect x="20" y="25" width="80" height="65" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1.5"/>
    {/* Calendar header */}
    <rect x="20" y="25" width="80" height="18" rx="6" fill="#0f172a"/>
    <rect x="20" y="37" width="80" height="6" fill="#0f172a"/>
    {/* Calendar rings */}
    <rect x="35" y="20" width="6" height="12" rx="2" fill="#475569"/>
    <rect x="79" y="20" width="6" height="12" rx="2" fill="#475569"/>
    {/* Day headers */}
    <rect x="28" y="50" width="10" height="6" rx="1" fill="#334155"/>
    <rect x="42" y="50" width="10" height="6" rx="1" fill="#334155"/>
    <rect x="56" y="50" width="10" height="6" rx="1" fill="#334155"/>
    <rect x="70" y="50" width="10" height="6" rx="1" fill="#334155"/>
    <rect x="84" y="50" width="10" height="6" rx="1" fill="#334155"/>
    {/* Calendar grid cells - some empty, one highlighted */}
    <rect x="28" y="60" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="42" y="60" width="10" height="10" rx="1" fill="#10b981" opacity="0.3" stroke="#10b981" strokeWidth="1"/>
    <rect x="56" y="60" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="70" y="60" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="84" y="60" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="28" y="74" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="42" y="74" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="56" y="74" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="70" y="74" width="10" height="10" rx="1" fill="#0f172a"/>
    <rect x="84" y="74" width="10" height="10" rx="1" fill="#0f172a"/>
  </svg>
);

const SearchIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Magnifying glass */}
    <circle cx="50" cy="45" r="22" fill="#1e293b" stroke="#6366f1" strokeWidth="2"/>
    <circle cx="50" cy="45" r="14" fill="#0f172a" stroke="#4f46e5" strokeWidth="1"/>
    <line x1="66" y1="61" x2="78" y2="73" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
    {/* Decorative elements inside magnifier */}
    <line x1="42" y1="40" x2="58" y2="40" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="42" y1="46" x2="54" y2="46" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="42" y1="52" x2="50" y2="52" stroke="#334155" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Floating elements */}
    <circle cx="90" cy="30" r="3" fill="#8b5cf6" opacity="0.4"/>
    <circle cx="85" cy="40" r="2" fill="#a78bfa" opacity="0.3"/>
    <rect x="88" y="50" width="6" height="6" rx="1" fill="#6366f1" opacity="0.3" transform="rotate(20 91 53)"/>
  </svg>
);

const SearchNoResultsIllustration: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Magnifying glass with X */}
    <circle cx="50" cy="45" r="22" fill="#1e293b" stroke="#ef4444" strokeWidth="2" opacity="0.6"/>
    <line x1="66" y1="61" x2="78" y2="73" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
    {/* X mark inside */}
    <line x1="42" y1="38" x2="58" y2="52" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
    <line x1="58" y1="38" x2="42" y2="52" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Question marks floating */}
    <text x="85" y="35" fontSize="12" fill="#64748b" fontFamily="sans-serif">?</text>
    <text x="92" y="50" fontSize="8" fill="#475569" fontFamily="sans-serif">?</text>
  </svg>
);

// ─── Illustration Map ────────────────────────────────────────────────────────

const illustrations: Record<EmptyStateVariant, React.FC<{ className?: string }>> = {
  'manuscript': ManuscriptIllustration,
  'manuscript-tree': ManuscriptTreeIllustration,
  'universe': UniverseIllustration,
  'timeline': TimelineIllustration,
  'calendar': CalendarIllustration,
  'calendars': CalendarIllustration,
  'search': SearchIllustration,
  'search-no-results': SearchNoResultsIllustration,
};

// ─── Default text by variant ─────────────────────────────────────────────────

const defaultTexts: Record<EmptyStateVariant, { title: string; hint: string }> = {
  'manuscript': {
    title: 'editor.noSceneSelected',
    hint: 'editor.noSceneHint',
  },
  'manuscript-tree': {
    title: 'manuscript.empty',
    hint: 'manuscript.emptyHint',
  },
  'universe': {
    title: 'universe.noEntrySelected',
    hint: 'universe.noEntrySelectedHint',
  },
  'timeline': {
    title: 'timeline.empty',
    hint: 'timeline.emptyHint',
  },
  'calendar': {
    title: 'calendars.empty',
    hint: 'calendars.emptyHint',
  },
  'calendars': {
    title: 'calendars.empty',
    hint: 'calendars.emptyHint',
  },
  'search': {
    title: 'search.typeToSearch',
    hint: 'search.typeToSearchHint',
  },
  'search-no-results': {
    title: 'search.noResults',
    hint: 'search.noResultsHint',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant,
  title,
  hint,
  action,
}) => {
  const { t } = useI18n();
  const Illustration = illustrations[variant];
  const defaults = defaultTexts[variant];

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
      {/* Illustration */}
      <div className="mb-5">
        <Illustration className="w-28 h-24" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
        {title ? t(title) : t(defaults.title)}
      </h3>

      {/* Hint */}
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {hint ? t(hint) : t(defaults.hint)}
      </p>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white text-xs font-medium rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
