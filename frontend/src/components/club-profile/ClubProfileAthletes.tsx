'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { ClubDetailsAthleteRow } from '@/types/clubs';
import {
  formatClubDate,
  latestDivisionLabel,
  registrationStatusVariant,
  splitCategoryCodes,
} from './clubProfile.utils';

type Props = {
  athletes: ClubDetailsAthleteRow[];
};

export function ClubProfileAthletes({ athletes }: Props) {
  const t = useTranslations('clubs.detail');
  const tSex = useTranslations('athleteProfile.identity.sexValue');
  const tStatus = useTranslations('clubs.detail.registrationStatus');
  const locale = useLocale();

  return (
    <Card className="space-y-5 p-5">
      <div>
        <SectionHeader title={t('athletes.title')} />
        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-muted)]">
          {t('athletes.subtitle')}
        </p>
      </div>

      {athletes.length === 0 ? (
        <EmptyState
          title={t('athletes.emptyTitle')}
          description={t('athletes.emptyDescription')}
        />
      ) : (
        <>
          <Table className="hidden lg:block">
            <TableHead>
              <TableHeader>{t('athletes.columns.athlete')}</TableHeader>
              <TableHeader>{t('athletes.columns.sex')}</TableHeader>
              <TableHeader>{t('athletes.columns.dateOfBirth')}</TableHeader>
              <TableHeader>{t('athletes.columns.latestDivision')}</TableHeader>
              <TableHeader>{t('athletes.columns.status')}</TableHeader>
              <TableHeader>{t('athletes.columns.activity')}</TableHeader>
            </TableHead>
            <TableBody>
              {athletes.map((athlete) => {
                const categories = splitCategoryCodes(athlete.categoryCodes);
                return (
                  <TableRow key={athlete.id}>
                    <TableCell>
                      <div className="space-y-2">
                        <Link
                          href={`/${locale}/admin/athletes/${athlete.id}`}
                          className="font-medium text-[var(--color-text)] hover:underline"
                        >
                          {athlete.fullName}
                        </Link>
                        <p className="text-[12px] text-[var(--color-text-muted)]">
                          {athlete.documentId
                            ? `${t('athletes.documentId')}: ${athlete.documentId}`
                            : t('athletes.noDocument')}
                        </p>
                        {categories.visible.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {categories.visible.map((code) => (
                              <span
                                key={code}
                                className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[11px] text-[var(--color-text)]"
                              >
                                {code}
                              </span>
                            ))}
                            {categories.hiddenCount > 0 ? (
                              <span className="rounded-full bg-[var(--color-surface-alt)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]">
                                {t('athletes.categoryMore', {
                                  count: categories.hiddenCount,
                                })}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell muted>
                      {athlete.sex ? tSex(athlete.sex) : '—'}
                    </TableCell>
                    <TableCell muted>
                      {formatClubDate(athlete.dateOfBirth, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-[13px] text-[var(--color-text)]">
                          {latestDivisionLabel(
                            athlete.latestRegistration,
                            t('unknownDivision'),
                          )}
                        </p>
                        {athlete.latestRegistration ? (
                          <p className="text-[12px] text-[var(--color-text-muted)]">
                            {t('athletes.latestEvent', {
                              event: athlete.latestRegistration.eventName,
                            })}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {athlete.latestRegistration ? (
                        <Badge
                          variant={registrationStatusVariant(
                            athlete.latestRegistration.status,
                          )}
                        >
                          {tStatus(athlete.latestRegistration.status)}
                        </Badge>
                      ) : (
                        <span className="text-[12px] text-[var(--color-text-muted)]">
                          {t('athletes.noRegistrations')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell muted>
                      {t('athletes.activity', {
                        active: athlete.activeRegistrationCount,
                        total: athlete.registrationCount,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="space-y-3 lg:hidden">
            {athletes.map((athlete) => {
              const categories = splitCategoryCodes(athlete.categoryCodes, 3);
              return (
                <div
                  key={athlete.id}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/35 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/admin/athletes/${athlete.id}`}
                        className="font-medium text-[var(--color-text)] hover:underline"
                      >
                        {athlete.fullName}
                      </Link>
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                        {athlete.sex ? tSex(athlete.sex) : '—'} ·{' '}
                        {formatClubDate(athlete.dateOfBirth, locale)}
                      </p>
                    </div>
                    {athlete.latestRegistration ? (
                      <Badge
                        variant={registrationStatusVariant(
                          athlete.latestRegistration.status,
                        )}
                      >
                        {tStatus(athlete.latestRegistration.status)}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-3 text-[13px] text-[var(--color-text)]">
                    {latestDivisionLabel(
                      athlete.latestRegistration,
                      t('unknownDivision'),
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {athlete.documentId
                      ? `${t('athletes.documentId')}: ${athlete.documentId}`
                      : t('athletes.noDocument')}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {t('athletes.activity', {
                      active: athlete.activeRegistrationCount,
                      total: athlete.registrationCount,
                    })}
                  </p>

                  {categories.visible.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {categories.visible.map((code) => (
                        <span
                          key={code}
                          className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-text)]"
                        >
                          {code}
                        </span>
                      ))}
                      {categories.hiddenCount > 0 ? (
                        <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[11px] text-[var(--color-text-muted)]">
                          {t('athletes.categoryMore', {
                            count: categories.hiddenCount,
                          })}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
