'use client';

import { Activity, Layers3, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

export function ClubProfileOverview({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[var(--color-border)]/80 bg-[linear-gradient(135deg,var(--color-primary-subtle),color-mix(in_srgb,var(--color-surface)_84%,var(--color-surface-alt)_16%))] px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          {t('overview.eyebrow')}
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <FactTile
            label={t('overview.facts.location')}
            value={formatClubLocation(club.city, club.country, t('locationMissing'))}
          />
          <FactTile
            label={t('overview.facts.created')}
            value={formatClubDate(club.createdAt, locale)}
          />
          <FactTile
            label={t('overview.facts.contacts')}
            value={
              club.contactEmails.length > 0
                ? club.contactEmails.slice(0, 2).join(' · ')
                : t('contactMissing')
            }
          />
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={t('overview.stats.coaches')}
          value={overview.totalCoaches}
          icon={<UserRound className="h-4 w-4" />}
          trend={t('overview.stats.coachesHint', {
            count: overview.activeCoachAccounts,
          })}
        />
        <KpiCard
          label={t('overview.stats.athletes')}
          value={overview.totalAthletes}
          icon={<Users className="h-4 w-4" />}
          trend={t('overview.stats.athletesHint', {
            male: overview.maleAthletes,
            female: overview.femaleAthletes,
          })}
        />
        <KpiCard
          label={t('overview.stats.activeAthletes')}
          value={overview.activeAthletes}
          icon={<ShieldCheck className="h-4 w-4" />}
          trend={t('overview.stats.activeAthletesHint')}
        />
        <KpiCard
          label={t('overview.stats.activeRegistrations')}
          value={overview.activeRegistrations}
          icon={<Activity className="h-4 w-4" />}
          trend={t('overview.stats.activeRegistrationsHint')}
        />
        <KpiCard
          label={t('overview.stats.categories')}
          value={overview.representedCategories}
          icon={<Layers3 className="h-4 w-4" />}
          trend={t('overview.stats.categoriesHint', {
            count: overview.representedCategories,
          })}
        />
      </div>
    </Card>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/82 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--color-text)]">
        {value}
      </p>
    </div>
  );
}
