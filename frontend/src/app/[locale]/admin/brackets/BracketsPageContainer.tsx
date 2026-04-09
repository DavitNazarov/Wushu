'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { useToast } from '@/components/ui/Toast';
import { ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { BracketCategoryFilters } from '@/features/brackets/components/BracketCategoryFilters';
import { BracketCategoryList } from '@/features/brackets/components/BracketCategoryList';
import { BracketDetailsPanel } from '@/features/brackets/components/BracketDetailsPanel';
import { BracketPublishDialog } from '@/features/brackets/components/BracketPublishDialog';
import { BracketRegenerateDialog } from '@/features/brackets/components/BracketRegenerateDialog';
import { BracketsAuditList } from '@/features/brackets/components/BracketsAuditList';
import { BracketsHeaderSummary } from '@/features/brackets/components/BracketsHeaderSummary';
import {
  filterAndSortBracketCategories,
  type BracketCategoryFilter,
  type BracketCategorySort,
} from '@/features/brackets/lib/bracketDisplayMapper';
import { useBracketsOverview } from './useBracketsOverview';
import { useBracketCategoryDetails } from './useBracketCategoryDetails';
import {
  useGenerateBracketExport,
  useRegenerateBrackets,
  useSetEventPublishState,
} from './useBracketActions';
import { BracketsMobileTabs } from './BracketsMobileTabs';

type Props = {
  eventId: string;
};

export function BracketsPageContainer({ eventId }: Props) {
  const t = useTranslations('brackets');
  const tCommon = useTranslations('common');
  const tFightStatus = useTranslations('common.fightStatus');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [filter, setFilter] = useState<BracketCategoryFilter>('ALL');
  const [sort, setSort] = useState<BracketCategorySort>('CATEGORY');
  const [publishDialogTarget, setPublishDialogTarget] = useState<boolean | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'categories' | 'selected'>('categories');

  const { events, setSelectedEventId } = useAdminEventRoute({ eventId, page: 'brackets' });

  const overviewQuery = useBracketsOverview(eventId);

  const filteredCategories = useMemo(
    () =>
      filterAndSortBracketCategories({
        categories: overviewQuery.data?.categories ?? [],
        filter,
        sort,
      }),
    [overviewQuery.data?.categories, filter, sort],
  );

  const resolvedSelectedCategoryId = useMemo(() => {
    if (!filteredCategories.length) return '';
    if (selectedCategoryId && filteredCategories.some((row) => row.id === selectedCategoryId)) {
      return selectedCategoryId;
    }
    return filteredCategories[0].id;
  }, [filteredCategories, selectedCategoryId]);

  const detailsQuery = useBracketCategoryDetails({
    eventId,
    eventWeightCategoryId: resolvedSelectedCategoryId,
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
      queryClient.invalidateQueries({ queryKey: ['brackets-overview', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['bracket-category-details', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ]);
  }

  function handleConfirmPublish() {
    if (!eventId || publishDialogTarget == null) return;

    publishMutation.mutate(
      {
        eventId,
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
    if (!eventId) return;

    exportMutation.mutate(
      { eventId },
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
    if (!eventId) return;

    regenerateMutation.mutate(
      { eventId, reason: input.reason },
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
    <div className="space-y-4 pb-32 md:pb-0">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
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

          <BracketsMobileTabs activeTab={mobileTab} onChange={setMobileTab} t={t} />

          <div className="grid min-w-0 gap-4 xl:h-[calc(100vh-var(--topbar-height)-18rem)] xl:grid-cols-[380px_1fr] xl:overflow-hidden">
            <div
              className={`min-w-0 space-y-3 xl:h-full xl:overflow-y-auto ${
                mobileTab === 'selected' ? 'hidden md:block' : ''
              }`}
            >
              <BracketCategoryFilters
                filter={filter}
                sort={sort}
                onFilter={setFilter}
                onSort={setSort}
                t={t}
              />
              <BracketCategoryList
                rows={filteredCategories}
                selectedId={resolvedSelectedCategoryId}
                onSelect={(value) => {
                  setSelectedCategoryId(value);
                  setMobileTab('selected');
                }}
                t={t}
              />
            </div>

            <div
              className={`min-w-0 space-y-3 xl:h-full xl:overflow-y-auto ${
                mobileTab === 'categories' ? 'hidden md:block' : ''
              }`}
            >
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileTab('categories')}
                  className="min-h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
                >
                  {tCommon('back')}
                </button>
              </div>
              {detailsQuery.error && (
                <AdminErrorAlert
                  error={detailsQuery.error}
                  fallbackMessage={tCommon('loadError')}
                  retryLabel={tCommon('retry')}
                  onRetry={() => detailsQuery.refetch()}
                />
              )}
              <div className="xl:sticky xl:top-0">
                <BracketDetailsPanel
                  details={detailsQuery.data ?? null}
                  isLoading={detailsQuery.isLoading}
                  t={t}
                  tFightStatus={tFightStatus}
                />
              </div>
            </div>
          </div>

          <BracketsAuditList entries={overviewQuery.data.audit.recent} t={t} />
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
