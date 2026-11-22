import React from 'react';
import {
  Sparkles,
  GitBranch,
  Heart,
  BookOpen,
  Compass,
  Calendar,
  Globe,
  Users,
  ExternalLink,
  Scale,
} from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from '../../i18n';
import { useEulaStore } from '../../store/eulaStore';

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

/**
 * Personas a las que se dedica el proyecto: sus ideas se han convertido en
 * funciones de Aetheria. Cada una tiene su propia dedicacion. Las dos
 * primeras llevan anotacion porque su vinculo con CultoDePapel.com es
 * conocido.
 */
const dedication: { name: string; noteKey?: string; textKey: string }[] = [
  {
    name: 'MANA',
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationMANA',
  },
  {
    name: 'Sylph',
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationSylph',
  },
  { 
    name: 'Cr0w', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationCr0w' 
  },
  { 
    name: 'Bullet', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationBullet' 
  },
  { 
    name: 'Ce-Elyra', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationCeElyra' 
  },
  { 
    name: 'Teleomega', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationTeleomega' 
  },
  { 
    name: 'Ahru', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationAhru' 
  },
  { 
    name: 'ProfeRyo', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationProfeRyo' 
  },
  { 
    name: 'EranMineri', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationEranMineri' 
  },
  { 
    name: 'LeaMarian', 
    noteKey: 'project.aboutDedicationCulto',
    textKey: 'project.dedicationLeaMarian' 
  },
];

/** Comunidad donde nacieron muchas de esas ideas. */
const COMMUNITY_URL = 'https://cultodepapel.com';

export const UpdatePanel: React.FC = () => {
  const { t } = useI18n();
  const openEula = useEulaStore((state) => state.open);

  const openExternal = async (url: string): Promise<void> => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const openGitHub = async () => {
    await openExternal('https://github.com/sayghteight/Aetheris');
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

        {/* Dedicatoria */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-500/10 via-amber-500/5 to-transparent rounded-3xl blur-xl" />
          <div className="relative rounded-2xl border border-fuchsia-500/20 bg-[var(--color-bg-secondary)]/60 backdrop-blur-sm p-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-amber-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-fuchsia-400" />
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                {t('project.aboutDedication')}
              </h3>
            </div>

            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {t('project.aboutDedicationDesc')}
            </p>

            {/* Una tarjeta por persona, con su dedicatoria */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dedication.map((person) => (
                <div
                  key={person.name}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]/50 p-4 transition-colors hover:border-amber-500/30"
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-sm font-bold tracking-wide text-amber-500">
                      {person.name}
                    </p>
                    {person.noteKey && (
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {t(person.noteKey)}
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                    {t(person.textKey)}
                  </p>
                </div>
              ))}
            </div>

            {/* Comunidad */}
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              {/* `whitespace-pre-line` para que los saltos de linea del texto
                  (la cita final) se respeten. */}
              <p className="whitespace-pre-line text-sm text-[var(--color-text-muted)] leading-relaxed">
                {t('project.aboutDedicationCommunity')}
              </p>
              <button
                type="button"
                onClick={() => void openExternal(COMMUNITY_URL)}
                className="lib-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-amber-500/50 hover:text-amber-500"
              >
                {t('project.aboutCommunityLink')}
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
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
            dangerouslySetInnerHTML={{ __html: t('project.aboutCreditsDesc', { author: 'Darthar' }) }}
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void openGitHub()}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-all duration-200 hover:border-amber-500/50 hover:text-amber-500 hover:shadow-lg hover:shadow-amber-900/20"
            >
              <GitBranch className="w-4 h-4" />
              {t('project.aboutViewOnGitHub')}
            </button>
            <button
              type="button"
              onClick={() => openEula()}
              className="lib-ring inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-amber-500/50 hover:text-amber-500"
            >
              <Scale className="w-4 h-4" />
              {t('project.aboutViewEula')}
            </button>
          </div>
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
