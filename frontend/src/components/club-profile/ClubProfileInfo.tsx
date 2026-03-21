'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

export function ClubProfileInfo({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();

  return (
    <Card className="space-y-5 p-5">
      <div>
        <SectionHeader title={t('info.title')} />
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
          {t('info.subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        <InfoRow
          label={t('info.fields.name')}
          value={club.name}
        />
        <InfoRow
          label={t('info.fields.location')}
          value={formatClubLocation(club.city, club.country, t('locationMissing'))}
        />
        <InfoRow
          label={t('info.fields.created')}
          value={formatClubDate(club.createdAt, locale)}
        />
        <InfoRow
          label={t('info.fields.updated')}
          value={formatClubDate(club.updatedAt, locale)}
        />
        <InfoRow
          label={t('info.fields.contacts')}
          value={club.contactEmails.length > 0 ? club.contactEmails.join(', ') : t('contactMissing')}
        />
        <InfoRow
          label={t('info.fields.sexSplit')}
          value={t('info.sexSplitValue', {
            male: overview.maleAthletes,
            female: overview.femaleAthletes,
            unknown: overview.unspecifiedSexAthletes,
          })}
        />
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          {t('info.fields.categories')}
        </p>
        {overview.representedCategoryCodes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {overview.representedCategoryCodes.map((code) => (
              <span
                key={code}
                className="rounded-full bg-[var(--color-surface-alt)] px-3 py-1.5 text-[12px] text-[var(--color-text)]"
              >
                {code}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
            {t('unknownDivision')}
          </p>
        )}
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-[14px] font-medium leading-6 text-[var(--color-text)]">
        {value}
      </p>
    </div>
  );
}
