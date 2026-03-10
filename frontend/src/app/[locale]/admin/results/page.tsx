'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { EventRow, ResultsSummaryResponse } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type ExportType = 'registrations' | 'brackets' | 'schedule' | 'results';

const EXPORT_TYPES: ExportType[] = ['registrations', 'brackets', 'schedule', 'results'];

export default function ResultsPage() {
  const t = useTranslations('results');
  const tCommon = useTranslations('common');
  const tBrackets = useTranslations('brackets');
  const { toast } = useToast();
  const [eventId, setEventId] = useState('');
  const [tab, setTab] = useState<'categories' | 'medal'>('categories');
  const [exportOpen, setExportOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportLinks, setExportLinks] = useState<Array<{ type: ExportType; url: string; id: string }>>([]);
  const [exportTypes, setExportTypes] = useState<Record<ExportType, boolean>>({
    registrations: false,
    brackets: false,
    schedule: false,
    results: true,
  });

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });
  const eid = eventId || events?.[0]?.id || '';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['results-summary', eid],
    queryFn: () => apiGet<ResultsSummaryResponse>(`/api/results/summary?eventId=${eid}`),
    enabled: !!eid,
  });

  const categories = data?.categories ?? [];
  const medalTable = data?.medalTable ?? [];

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
      const res = await apiPost<{ links: Array<{ type: ExportType; url: string; id: string }> }>('/api/exports', {
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
            <select className={SEL} value={eid} onChange={(e) => setEventId(e.target.value)}>
              {events?.map((ev) => (
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
          {t('totalCategories')}: <strong>{summaryTotals.totalCategories}</strong>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
          {t('completedCategories')}: <strong>{summaryTotals.completedCategories}</strong>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[13px]">
          {t('needsReviewCategories')}: <strong>{summaryTotals.needsReview}</strong>
        </div>
      </div>

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

      <div
        className={`fixed inset-0 z-40 transition ${exportOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!exportOpen}
      >
        <div
          className={`absolute inset-0 bg-black/45 transition-opacity ${exportOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setExportOpen(false)}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-[420px] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-transform ${exportOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-text)]">{t('export')}</h2>
            <button
              type="button"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              onClick={() => setExportOpen(false)}
            >
              {tCommon('close')}
            </button>
          </div>

          <div className="space-y-2">
            {EXPORT_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 py-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={exportTypes[type]}
                  onChange={(e) => setExportTypes((prev) => ({ ...prev, [type]: e.target.checked }))}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <PrimaryButton
              className="h-10"
              disabled={!eid || isGenerating || !EXPORT_TYPES.some((type) => exportTypes[type])}
              onClick={onGenerateExports}
            >
              {isGenerating ? tCommon('loading') : tCommon('create')}
            </PrimaryButton>
            <SecondaryButton className="h-10" onClick={() => setExportOpen(false)}>
              {tCommon('cancel')}
            </SecondaryButton>
          </div>

          {exportLinks.length > 0 && (
            <div className="mt-5 space-y-2">
              {exportLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]"
                >
                  <span>{link.type}</span>
                  <Download className="h-4 w-4 text-[var(--color-text-muted)]" />
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
