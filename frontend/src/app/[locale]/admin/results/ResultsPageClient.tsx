'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { ResultsSummaryResponse } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { ResultsExportDrawer, type ResultsExportType } from './ResultsExportDrawer';
import { ResultsSummaryCards } from './ResultsSummaryCards';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

const EXPORT_TYPES: ResultsExportType[] = ['registrations', 'brackets', 'schedule', 'results'];

type Props = { eventId: string };

export function ResultsPageClient({ eventId }: Props) {
  const t = useTranslations('results');
  const tCommon = useTranslations('common');
  const tBrackets = useTranslations('brackets');
  const { toast } = useToast();
  const [tab, setTab] = useState<'categories' | 'medal'>('categories');
  const [exportOpen, setExportOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportLinks, setExportLinks] = useState<Array<{ type: ResultsExportType; url: string; id: string }>>([]);
  const [exportTypes, setExportTypes] = useState<Record<ResultsExportType, boolean>>({
    registrations: false,
    brackets: false,
    schedule: false,
    results: true,
  });

  const { events, setSelectedEventId } = useAdminEventRoute({ eventId, page: 'results' });
  const eid = eventId;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['results-summary', eid],
    queryFn: () => apiGet<ResultsSummaryResponse>(`/api/results/summary?eventId=${eid}`),
    enabled: !!eid,
  });

  const categories = useMemo(() => data?.categories ?? [], [data?.categories]);
  const medalTable = useMemo(() => data?.medalTable ?? [], [data?.medalTable]);

  const summaryTotals = useMemo(
    () => ({
      totalCategories: categories.length,
      completedCategories: categories.filter((row) => row.completionState === 'COMPLETED').length,
      needsReview: categories.filter((row) => row.needsReview).length,
    }),
    [categories],
  );

  async function onGenerateExports() {
    const selectedTypes = EXPORT_TYPES.filter((type) => exportTypes[type]);
    if (!eid || selectedTypes.length === 0) return;
    setIsGenerating(true);
    try {
      const res = await apiPost<{
        links: Array<{ type: ResultsExportType; url: string; id: string }>;
      }>('/api/exports', {
        eventId: eid,
        types: selectedTypes,
      });
      setExportLinks(res.links ?? []);
      toast(tCommon('saveSuccess'));
    } catch (e) {
      toast(getCompactErrorMessage(e, tCommon('error')), 'error');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <>
            <select className={SEL} value={eid} onChange={(event) => setSelectedEventId(event.target.value)}>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <SecondaryButton className="h-10" onClick={() => setExportOpen(true)} disabled={!eid}>
              {t('export')}
            </SecondaryButton>
          </>
        }
      />

      <ResultsSummaryCards
        totalCategories={summaryTotals.totalCategories}
        completedCategories={summaryTotals.completedCategories}
        needsReview={summaryTotals.needsReview}
        t={(key) => t(key as Parameters<typeof t>[0])}
      />

      <div className="inline-flex rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[13px] ${
            tab === 'categories'
              ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
          onClick={() => setTab('categories')}
        >
          {t('categoryResults')}
        </button>
        <button
          type="button"
          className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[13px] ${
            tab === 'medal'
              ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
          onClick={() => setTab('medal')}
        >
          {t('medalTable')}
        </button>
      </div>

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {isLoading ? (
        <SkeletonRows rows={6} cols={4} />
      ) : tab === 'categories' ? (
        categories.length === 0 ? (
          <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <section
                key={category.eventWeightCategoryId}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[16px] font-semibold text-[var(--color-text)]">{category.categoryName}</p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {category.ageGroupName ?? '—'}
                    </p>
                  </div>
                  <span className="rounded-[var(--radius-pill)] border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-semibold">
                    {tBrackets(`format.${category.competitionFormat}`)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
                    {t('athletes')}: {category.athleteCount}
                  </div>
                  <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
                    {t('progress')}: {category.completedFights}/{category.totalFights}
                  </div>
                  <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
                    {t('completion')}: {t(`completionState.${category.completionState}`)}
                  </div>
                  <div className="rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] px-3 py-2">
                    {t('needsReview')}: {category.needsReview ? t('needsReviewYes') : t('needsReviewNo')}
                  </div>
                </div>

                {category.needsReview && category.issues.length > 0 && (
                  <div className="mt-3 rounded-[var(--radius-input)] border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
                    <p className="font-semibold">{t('issues')}</p>
                    <p className="mt-1">{category.issues.map((issue) => issue.code).join(', ')}</p>
                  </div>
                )}

                {category.competitionFormat === 'ROUND_ROBIN' ? (
                  <div className="mt-3 overflow-x-auto rounded-[var(--radius-input)] border border-[var(--color-border)]">
                    <table className="min-w-full text-[12px]">
                      <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.rank')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.athlete')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.points')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.wins')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.losses')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.pending')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('standingsColumns.tieBreakWins')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {(category.standings ?? []).map((row) => (
                          <tr key={row.athleteId}>
                            <td className="px-3 py-2">{row.rank}</td>
                            <td className="px-3 py-2">{row.athleteName}</td>
                            <td className="px-3 py-2">{row.points}</td>
                            <td className="px-3 py-2">{row.wins}</td>
                            <td className="px-3 py-2">{row.losses}</td>
                            <td className="px-3 py-2">{row.pending}</td>
                            <td className="px-3 py-2">{row.tieBreakWins}</td>
                          </tr>
                        ))}
                        {(category.standings ?? []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-3 py-2 text-[var(--color-text-muted)]">
                              {t('noStandings')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2">
                      {category.competitionFormat === 'DIRECT_FINAL' ? t('winner') : t('champion')}:{' '}
                      {category.medalists.gold?.athleteName ?? '—'}
                    </div>
                    <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2">
                      {category.competitionFormat === 'DIRECT_FINAL' ? t('runnerUp') : t('finalist')}:{' '}
                      {category.medalists.silver?.athleteName ?? '—'}
                    </div>
                    <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 sm:col-span-2">
                      {t('bronze')}: {category.medalists.bronze.map((row) => row.athleteName).filter(Boolean).join(', ') || '—'}
                    </div>
                  </div>
                )}

                {category.finalFight && (
                  <div className="mt-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[12px]">
                    {t('finalBout')}: #{category.finalFight.boutNo} · {category.finalFight.stageLabel} ·{' '}
                    {category.finalFight.redAthleteName ?? '—'} vs {category.finalFight.blueAthleteName ?? '—'}
                  </div>
                )}
              </section>
            ))}
          </div>
        )
      ) : medalTable.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-alt)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('medalColumns.club')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('medalColumns.gold')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('medalColumns.silver')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('medalColumns.bronze')}</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{t('medalColumns.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {medalTable.map((row) => (
                <tr key={`${row.clubId ?? 'none'}:${row.clubName}`} className="bg-[var(--color-surface)]">
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.clubName}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.gold}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.silver}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.bronze}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResultsExportDrawer
        open={exportOpen}
        eventId={eid}
        exportTypes={exportTypes}
        exportLinks={exportLinks}
        isGenerating={isGenerating}
        onClose={() => setExportOpen(false)}
        onGenerate={onGenerateExports}
        onExportTypeChange={(type, checked) =>
          setExportTypes((prev) => ({ ...prev, [type]: checked }))
        }
        t={(key) => t(key as Parameters<typeof t>[0])}
        tCommon={(key) => tCommon(key as Parameters<typeof tCommon>[0])}
      />
    </div>
  );
}
