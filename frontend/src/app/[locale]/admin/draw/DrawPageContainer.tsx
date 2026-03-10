'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { useToast } from '@/components/ui/Toast';
import { apiGet, ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { EventRow } from '@/types/api';
import { useDrawOverview } from './useDrawOverview';
import { useDrawCategoryDetails } from './useDrawCategoryDetails';
import { useGenerateDraw } from './useGenerateDraw';
import { DrawHeaderSummary } from './DrawHeaderSummary';
import { DrawCategoryFilters } from './DrawCategoryFilters';
import { DrawCategoryList } from './DrawCategoryList';
import { DrawCategoryDetailsPanel } from './DrawCategoryDetailsPanel';
import { DrawValidationPanel } from './DrawValidationPanel';
import { DrawWarningBanner } from './DrawWarningBanner';
import { DrawMobileTabs } from './DrawMobileTabs';
import { DrawMobileBottomBars } from './DrawMobileBottomBars';
import {
  filterAndSortCategories,
  type DrawCategoryFilter,
  type DrawCategorySort,
} from './drawReadinessMapper';
import { GenerateDrawDialog } from './GenerateDrawDialog';
import { RegenerateDrawDialog } from './RegenerateDrawDialog';

export function DrawPageContainer() {
  const t = useTranslations('draw');
  const tC = useTranslations('common');
  const tNav = useTranslations('nav');
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const pathname = usePathname();
  const { toast } = useToast();

  const [eventId, setEventId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [filter, setFilter] = useState<DrawCategoryFilter>('ALL');
  const [onlyWithAthletes, setOnlyWithAthletes] = useState(false);
  const [sort, setSort] = useState<DrawCategorySort>('CATEGORY');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'categories' | 'selected'>('categories');

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const currentEventId = eventId || events[0]?.id || '';

  useEffect(() => {
    if (!currentEventId && events[0]?.id) {
      setEventId(events[0].id);
    }
  }, [currentEventId, events]);

  const overviewQuery = useDrawOverview(currentEventId);

  const filteredCategories = useMemo(
    () =>
      filterAndSortCategories({
        categories: overviewQuery.data?.categories ?? [],
        filter,
        onlyWithAthletes,
        sort,
      }),
    [overviewQuery.data?.categories, filter, onlyWithAthletes, sort],
  );

  useEffect(() => {
    if (!filteredCategories.length) {
      setSelectedCategoryId('');
      return;
    }
    if (!selectedCategoryId || !filteredCategories.some((row) => row.id === selectedCategoryId)) {
      setSelectedCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, selectedCategoryId]);

  const categoryDetailsQuery = useDrawCategoryDetails({
    eventId: currentEventId,
    eventWeightCategoryId: selectedCategoryId,
  });

  const generateMutation = useGenerateDraw();

  function handleMutationError(error: unknown) {
    const message =
      error instanceof ApiError
        ? error.message
        : getCompactErrorMessage(error, tC('error'));
    toast(message, 'error');
  }

  function handleGenerate(input: { seed?: number; sameClubSeparation: boolean }) {
    if (!currentEventId) return;
    generateMutation.mutate(
      {
        eventId: currentEventId,
        seed: input.seed,
        sameClubSeparation: input.sameClubSeparation,
      },
      {
        onSuccess: () => {
          setGenerateOpen(false);
          toast(t('drawSuccess'));
        },
        onError: handleMutationError,
      },
    );
  }

  function handleRegenerate(input: {
    reason: string;
    seed?: number;
    sameClubSeparation: boolean;
  }) {
    if (!currentEventId) return;
    generateMutation.mutate(
      {
        eventId: currentEventId,
        seed: input.seed,
        sameClubSeparation: input.sameClubSeparation,
        override: true,
        reason: input.reason,
      },
      {
        onSuccess: () => {
          setRegenerateOpen(false);
          toast(t('regenerateSuccess'));
        },
        onError: handleMutationError,
      },
    );
  }

  return (
    <div className="space-y-4 pb-32 md:pb-0">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <select
            value={currentEventId}
            onChange={(event) => {
              setEventId(event.target.value);
              setSelectedCategoryId('');
            }}
            className="h-10 min-w-[220px] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        }
      />

      {events.length === 0 && (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      )}

      {overviewQuery.error && (
        <AdminErrorAlert
          error={overviewQuery.error}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={() => overviewQuery.refetch()}
        />
      )}

      {overviewQuery.isLoading && (
        <div className="space-y-4">
          <SkeletonKpiRow count={4} />
          <SkeletonRows rows={5} cols={4} />
        </div>
      )}

      {overviewQuery.data && (
        <>
          <DrawHeaderSummary
            locale={locale}
            overview={overviewQuery.data}
            generating={generateMutation.isPending && !regenerateOpen}
            regenerating={generateMutation.isPending && regenerateOpen}
            onGenerate={() => setGenerateOpen(true)}
            onRegenerate={() => setRegenerateOpen(true)}
            t={t}
          />

          <DrawWarningBanner
            issueCount={
              overviewQuery.data.validation.warnings.length +
              overviewQuery.data.validation.critical.length
            }
            onJump={() =>
              document
                .getElementById('draw-validation-panel')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
            t={t}
          />

          <DrawMobileTabs activeTab={mobileTab} onChange={setMobileTab} t={t} />

          <div className="grid min-w-0 gap-4 xl:h-[calc(100vh-var(--topbar-height)-18rem)] xl:grid-cols-[370px_1fr] xl:overflow-hidden">
            <div
              className={`min-w-0 space-y-3 xl:h-full xl:overflow-y-auto ${
                mobileTab === 'selected' ? 'hidden md:block' : ''
              }`}
            >
              <DrawCategoryFilters
                filter={filter}
                onlyWithAthletes={onlyWithAthletes}
                sort={sort}
                totalCount={overviewQuery.data.categories.length}
                shownCount={filteredCategories.length}
                onFilter={setFilter}
                onOnlyWithAthletesChange={setOnlyWithAthletes}
                onSort={setSort}
                t={t}
              />
              <DrawCategoryList
                rows={filteredCategories}
                selectedId={selectedCategoryId}
                onSelect={(id) => {
                  setSelectedCategoryId(id);
                  setMobileTab('selected');
                }}
                t={t}
              />
            </div>

            <div
              className={`min-w-0 space-y-2 xl:h-full xl:overflow-y-auto ${
                mobileTab === 'categories' ? 'hidden md:block' : ''
              }`}
            >
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileTab('categories')}
                  className="min-h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
                >
                  {tC('back')}
                </button>
              </div>
              <div className="xl:sticky xl:top-0">
                <DrawCategoryDetailsPanel
                  details={categoryDetailsQuery.data ?? null}
                  isLoading={categoryDetailsQuery.isLoading}
                  t={t}
                />
              </div>
            </div>
          </div>

          <DrawValidationPanel sectionId="draw-validation-panel" overview={overviewQuery.data} t={t} />
        </>
      )}

      <GenerateDrawDialog open={generateOpen} overview={overviewQuery.data ?? null} pending={generateMutation.isPending} onClose={() => setGenerateOpen(false)} onConfirm={handleGenerate} t={t} />

      <RegenerateDrawDialog open={regenerateOpen} overview={overviewQuery.data ?? null} pending={generateMutation.isPending} onClose={() => setRegenerateOpen(false)} onConfirm={handleRegenerate} t={t} />

      <DrawMobileBottomBars overview={overviewQuery.data ?? null} currentEventId={currentEventId} locale={locale} pathname={pathname} onGenerate={() => setGenerateOpen(true)} onRegenerate={() => setRegenerateOpen(true)} t={t} tNav={(key) => tNav(key as Parameters<typeof tNav>[0])} tPublic={(key) => tPublic(key as Parameters<typeof tPublic>[0])} />
    </div>
  );
}
