'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClubDetailsAthleteRow } from '@/types/clubs';
import { formatClubDate, latestDivisionLabel, registrationStatusVariant, splitCategoryCodes } from './clubProfile.utils';

type Props = { athletes: ClubDetailsAthleteRow[] };

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 5 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

export function ClubProfileAthletes({ athletes }: Props) {
  const t = useTranslations('clubs.detail');
  const tSex = useTranslations('athleteProfile.identity.sexValue');
  const tStatus = useTranslations('clubs.detail.registrationStatus');
  const locale = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
    >
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{t('athletes.title')}</h3>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{t('athletes.subtitle')}</p>
          </div>
          {athletes.length > 0 && (
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)]">
              {athletes.length}
            </span>
          )}
        </div>

        {athletes.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t('athletes.emptyTitle')} description={t('athletes.emptyDescription')} />
          </div>
        ) : (
          <motion.div className="divide-y divide-[var(--color-border)]/50" variants={container} initial="hidden" animate="show">
            {athletes.map((athlete) => {
              const initials = athlete.fullName.split(' ').map((n: string) => n.charAt(0)).slice(0, 2).join('').toUpperCase();
              const categories = splitCategoryCodes(athlete.categoryCodes);
              const division = latestDivisionLabel(athlete.latestRegistration, t('unknownDivision'));

              return (
                <motion.div key={athlete.id} variants={item}>
                  <Link
                    href={`/${locale}/admin/athletes/${athlete.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-surface-alt)]/50"
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-subtle)] text-[12px] font-bold uppercase text-[var(--color-primary)]">
                      {initials}
                    </div>

                    {/* Main info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-[14px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                          {athlete.fullName}
                        </p>
                        {athlete.sex && (
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {tSex(athlete.sex)}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          {formatClubDate(athlete.dateOfBirth, locale)}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-muted)]">
                        <span>{division}</span>
                        {athlete.latestRegistration?.eventName && (
                          <span className="truncate max-w-[180px]">{athlete.latestRegistration.eventName}</span>
                        )}
                        {!athlete.documentId && (
                          <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
                            <FileText className="h-3 w-3" />
                            {t('athletes.noDocument')}
                          </span>
                        )}
                      </div>

                      {categories.visible.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {categories.visible.map((code) => (
                            <span key={code} className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] text-[var(--color-text)]">
                              {code}
                            </span>
                          ))}
                          {categories.hiddenCount > 0 && (
                            <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                              +{categories.hiddenCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status + activity */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {athlete.latestRegistration ? (
                        <Badge variant={registrationStatusVariant(athlete.latestRegistration.status)}>
                          {tStatus(athlete.latestRegistration.status)}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-muted)]">{t('athletes.noRegistrations')}</span>
                      )}
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {t('athletes.activity', { active: athlete.activeRegistrationCount, total: athlete.registrationCount })}
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
