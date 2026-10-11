import React from 'react';
import { Sparkles, GitBranch, Heart, BookOpen, Compass, Calendar, Globe } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';

import { VERSION } from '../../utils/version';

const features = [
  {
    icon: BookOpen,
    labelKey: 'project.digitalManuscript',
    descKey: 'project.digitalManuscriptDesc',
  },
  {
    icon: Compass,
    labelKey: 'project.narrativeUniverse',
    descKey: 'project.narrativeUniverseDesc',
  },
  {
    icon: Calendar,
    labelKey: 'project.timelineFeature',
    descKey: 'project.timelineFeatureDesc',
  },
  {
    icon: Globe,
    labelKey: 'project.customCalendars',
    descKey: 'project.customCalendarsDesc',
  },
];

export const UpdatePanel: React.FC = () => {
  const { t } = useI18n();
  const openGitHub = async () => {
    try {
      await openUrl('https://github.com/sayghteight/culto-guieditor');
    } catch {
      window.open('https://github.com/sayghteight/culto-guieditor', '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Logo y versión */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/20 blur-2xl rounded-full scale-150" />
            <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-900/40">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-white">
            Aetheria
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {t('common.version')} {VERSION}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)] opacity-60">
            {t('app.tagline')}
          </p>
        </div>

        {/* Descripción */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent rounded-3xl blur-xl" />
          <div className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm p-8">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)] text-lg mb-2">
                  {t('project.aboutWhatIs')}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {t('project.aboutWhatIsDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Características */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.labelKey}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 p-5 transition-all duration-200 hover:bg-[var(--color-bg-secondary)]/60 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-900/10"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/15 to-orange-600/15 flex items-center justify-center transition-colors group-hover:from-amber-500/25 group-hover:to-orange-600/25">
                    <Icon className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)] text-sm">
                      {t(item.labelKey)}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                      {t(item.descKey)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Credits y enlaces */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 backdrop-blur-sm p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              {t('project.aboutCredits')}
            </h3>
          </div>
          <p
            className="text-sm text-[var(--color-text-muted)] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: t('project.aboutCreditsDesc', { author: 'sayghteight' }) }}
          />
          <button
            onClick={() => void openGitHub()}
            className="inline-flex items-center gap-2 mt-5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-all duration-200 hover:border-amber-500/50 hover:text-amber-500 hover:shadow-lg hover:shadow-amber-900/20"
          >
            <GitBranch className="w-4 h-4" />
            {t('project.aboutViewOnGitHub')}
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Heart className="w-3.5 h-3.5 text-fuchsia-500" />
          <span>{t('project.aboutFooter')}</span>
        </div>
      </div>
    </div>
  );
};
