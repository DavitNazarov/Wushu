'use client';

import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Building2, CalendarDays, Mail, MapPin, RefreshCw, Tag } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { ClubDetailsResponse } from '@/types/clubs';
import { formatClubDate, formatClubLocation } from './clubProfile.utils';

type Props = Pick<ClubDetailsResponse, 'club' | 'overview'>;

export function ClubProfileInfo({ club, overview }: Props) {
  const t = useTranslations('clubs.detail');
  const locale = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)]/60 px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{t('info.title')}</h3>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('info.subtitle')}</p>
        </div>

        <div className="divide-y divide-[var(--color-border)]/50">
          <InfoRow icon={Building2} label={t('info.fields.name')} value={club.name} />
          <InfoRow icon={MapPin} label={t('info.fields.location')} value={formatClubLocation(club.city, club.country, t('locationMissing'))} />
          <InfoRow icon={CalendarDays} label={t('info.fields.created')} value={formatClubDate(club.createdAt, locale)} />
          <InfoRow icon={RefreshCw} label={t('info.fields.updated')} value={formatClubDate(club.updatedAt, locale)} />
          {club.contactEmails.length > 0 && (
            <InfoRow icon={Mail} label={t('info.fields.contacts')} value={club.contactEmails.join(', ')} />
          )}
          <InfoRow
            icon={Tag}
            label={t('info.fields.sexSplit')}
            value={t('info.sexSplitValue', {
              male: overview.maleAthletes,
              female: overview.femaleAthletes,
              unknown: overview.unspecifiedSexAthletes,
            })}
          />
        </div>

        {overview.representedCategoryCodes.length > 0 && (
          <div className="border-t border-[var(--color-border)]/50 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('info.fields.categories')}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {overview.representedCategoryCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-text)]"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/40">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-0.5 text-[13px] font-medium text-[var(--color-text)] break-words">{value}</p>
      </div>
    </div>
  );
}
