'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { useToast } from '@/components/ui/Toast';
import { apiGet, ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { EventRow } from '@/types/api';
import { useBracketsOverview } from './useBracketsOverview';
import { useBracketCategoryDetails } from './useBracketCategoryDetails';
import {
  useGenerateBracketExport,
  useRegenerateBrackets,
  useSetEventPublishState,
} from './useBracketActions';
import { BracketsHeaderSummary } from './BracketsHeaderSummary';
import { BracketCategoryFilters } from './BracketCategoryFilters';
import { BracketCategoryList } from './BracketCategoryList';
import { BracketDetailsPanel } from './BracketDetailsPanel';
import { BracketPublishDialog } from './BracketPublishDialog';
import { BracketRegenerateDialog } from './BracketRegenerateDialog';
import { formatDateTime } from './dateFormat';
import {
  filterAndSortBracketCategories,
  type BracketCategoryFilter,
  type BracketCategorySort,
} from './bracketDisplayMapper';

export function BracketsPageContainer() {
  const t = useTranslations('brackets');
  const tCommon = useTranslations('common');
  const tFightStatus = useTranslations('common.fightStatus');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [eventId, setEventId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [filter, setFilter] = useState<BracketCategoryFilter>('ALL');
  const [sort, setSort] = useState<BracketCategorySort>('CATEGORY');
  const [publishDialogTarget, setPublishDialogTarget] = useState<boolean | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

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

  const overviewQuery = useBracketsOverview(currentEventId);

  const filteredCategories = useMemo(
    () =>
      filterAndSortBracketCategories({
        categories: overviewQuery.data?.categories ?? [],
        filter,
        sort,
      }),
    [overviewQuery.data?.categories, filter, sort],
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

  const detailsQuery = useBracketCategoryDetails({
    eventId: currentEventId,
    eventWeightCategoryId: selectedCategoryId,
  });

  const publishMutation = useSetEventPublishState();
  const exportMutation = useGenerateBracketExport();
  const regenerateMutation = useRegenerateBrackets();

  function handleError(error: unknown) {
    const message =
      error instanceof ApiError
        ? error.message
        : getCompactErrorMessage(error, tCommon('error'));
    toast(message, 'error');
  }

  function refreshBracketsData() {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ['brackets-overview', currentEventId] }),
      queryClient.invalidateQueries({ queryKey: ['bracket-category-details', currentEventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }

  function handleConfirmPublish() {
    if (!currentEventId || publishDialogTarget == null) return;

    publishMutation.mutate(
      {
        eventId: currentEventId,
        published: publishDialogTarget,
      },
      {
        onSuccess: () => {
          setPublishDialogTarget(null);
          refreshBracketsData();
          toast(
            publishDialogTarget
              ? t('publishSuccess')
              : t('unpublishSuccess'),
          );
        },
        onError: handleError,
      },
    );
  }

  function handleExport() {
    if (!currentEventId) return;

    exportMutation.mutate(
      { eventId: currentEventId },
      {
        onSuccess: (result) => {
          const link = result.links.find((entry) => entry.type === 'brackets') ?? result.links[0];
          if (link && typeof window !== 'undefined') {
            window.open(link.url, '_blank', 'noopener,noreferrer');
          }
          toast(t('exportSuccess'));
        },
        onError: handleError,
      },
    );
  }

  function handleRegenerate(input: { reason: string }) {
    if (!currentEventId) return;

    regenerateMutation.mutate(
      { eventId: currentEventId, reason: input.reason },
      {
        onSuccess: () => {
          setRegenerateOpen(false);
          refreshBracketsData();
          toast(t('regenerateSuccess'));
        },
        onError: handleError,
      },
    );
  }

  return (
    <div className="space-y-4">
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
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
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
          <BracketsHeaderSummary
            overview={overviewQuery.data}
            publishPending={publishMutation.isPending}
            regeneratePending={regenerateMutation.isPending}
            exportPending={exportMutation.isPending}
            onPublish={() => setPublishDialogTarget(true)}
            onUnpublish={() => setPublishDialogTarget(false)}
            onRegenerate={() => setRegenerateOpen(true)}
            onExport={handleExport}
            onRefresh={refreshBracketsData}
            t={t}
          />

          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <div className="space-y-3">
              <BracketCategoryFilters
                filter={filter}
                sort={sort}
                onFilter={setFilter}
                onSort={setSort}
                t={t}
              />
              <BracketCategoryList
                rows={filteredCategories}
                selectedId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
                t={t}
              />
            </div>

            <div className="space-y-3">
              {detailsQuery.error && (
                <AdminErrorAlert
                  error={detailsQuery.error}
                  fallbackMessage={tCommon('loadError')}
                  retryLabel={tCommon('retry')}
                  onRetry={() => detailsQuery.refetch()}
                />
              )}
              <BracketDetailsPanel
                details={detailsQuery.data ?? null}
                isLoading={detailsQuery.isLoading}
                t={t}
                tFightStatus={tFightStatus}
              />
            </div>
          </div>

          <section
            id="bracket-audit"
            className="space-y-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <h3 className="text-[13px] font-semibold text-[var(--color-text)]">{t('auditTitle')}</h3>
            {overviewQuery.data.audit.recent.length === 0 ? (
              <p className="text-[12px] text-[var(--color-text-muted)]">{t('auditEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {overviewQuery.data.audit.recent.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-2 text-[12px]"
                  >
                    <p className="font-medium text-[var(--color-text)]">
                      {t(`auditAction.${entry.action}`)}
                    </p>
                    <p className="text-[var(--color-text-muted)]">
                      {formatDateTime(entry.createdAt)} · {entry.actorDisplayName ?? t('unknownUser')}
                    </p>
                    {entry.reason && (
                      <p className="text-[var(--color-text-muted)]">{t('reasonLabel')}: {entry.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <BracketPublishDialog
        open={publishDialogTarget != null}
        targetPublished={publishDialogTarget === true}
        overview={overviewQuery.data ?? null}
        pending={publishMutation.isPending}
        onClose={() => setPublishDialogTarget(null)}
        onConfirm={handleConfirmPublish}
        t={t}
        tCommon={tCommon}
      />

      <BracketRegenerateDialog
        open={regenerateOpen}
        overview={overviewQuery.data ?? null}
        pending={regenerateMutation.isPending}
        onClose={() => setRegenerateOpen(false)}
        onConfirm={handleRegenerate}
        t={t}
        tCommon={(key) => tCommon(key as Parameters<typeof tCommon>[0])}
      />
    </div>
  );
}
