'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { usePublicWeighInResults } from '@/hooks/usePublicApi';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import { EventTabPanelFallback } from '@/components/event/EventTabPanelFallback';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineAlert } from '@/components/ui/InlineAlert';

function formatWeight(weightKg: number | null, locale: string): string {
  if (weightKg == null) return '—';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    weightKg,
  )} kg`;
}

export function WeighInResultsTab({ eventSlug }: { eventSlug: string }) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data, isLoading, error, refetch, isFetched } =
    usePublicWeighInResults(eventSlug);

  if (isLoading) return <EventTabPanelFallback rows={4} />;

  if (error) {
    return (
      <InlineAlert
        variant="error"
        actions={
          <button
            onClick={() => refetch()}
            className="text-[13px] font-medium underline"
          >
            {tCommon('retry')}
          </button>
        }
      >
        {tCommon('loadError')}
      </InlineAlert>
    );
  }

  if (isFetched && (!data || data.categories.length === 0)) {
    return (
      <EmptyState
        title={tPublic('weighInResultsNotPublished')}
        description={tPublic('weighInResultsNotPublishedDescription')}
      />
    );
  }

  return (
    <div className="space-y-5">
      {data?.categories.map((category) => (
        <section
          key={category.id}
          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--color-text)]">
                {category.categoryName}
              </h3>
              <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                {category.ageGroupName}
                {category.division
                  ? ` · ${tPublic(
                      `division.${category.division}` as Parameters<
                        typeof tPublic
                      >[0],
                    )}`
                  : ''}
              </p>
            </div>
            <span className="text-[12px] text-[var(--color-text-muted)]">
              {tPublic('weighInResultsAthleteCount', {
                count: category.athletes.length,
              })}
            </span>
          </header>

          <ul className="divide-y divide-[var(--color-border)]">
            {category.athletes.map((athlete) => (
              <li
                key={athlete.athleteId}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/${locale}/athletes/${athlete.athleteId}`}
                    className="truncate text-[14px] font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]"
                  >
                    {localizedFullName(
                      athlete.firstName,
                      athlete.lastName,
                      athlete.firstNameKa,
                      athlete.lastNameKa,
                      locale,
                    )}
                  </Link>
                  {athlete.clubName && (
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {localizedName(athlete.clubName, athlete.clubNameKa, locale)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums text-[14px] font-semibold text-[var(--color-text)]">
                  {formatWeight(athlete.weightKg, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
