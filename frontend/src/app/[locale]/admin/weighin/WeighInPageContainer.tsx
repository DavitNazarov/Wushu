'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';
import { apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { toWeighInCategoryList } from '@/lib/weighin/category';
import {
  buildWeighInQueueGroups,
  formatWeighInQueueGroupHeading,
} from '@/lib/weighin/queue';
import type { WeighInDecision, WeighInListEntry, WeighInQueueFilter } from '@/types/weighin';
import { WeighInToolbar } from './WeighInToolbar';
import { WeighInAthleteList } from './WeighInAthleteList';
import { WeighInDetailsPanel } from './WeighInDetailsPanel';
import { WeighInOverrideDialog } from './WeighInOverrideDialog';
import { useWeighInAthletes } from './useWeighInAthletes';
import { useWeighInDecisionPreview } from './useWeighInDecisionPreview';
import { useRecordWeighIn } from './useRecordWeighIn';
import { matchesQueueFilter } from './weighInStatusFormatter';

function normalizeWeight(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

function toCategories(entry: WeighInListEntry | null) {
  return toWeighInCategoryList(entry);
}

export function WeighInPageContainer() {
  const t = useTranslations('weighin');
  const tC = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEventsGate = useTranslations('admin.events');
  const tNav = useTranslations('nav');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WeighInQueueFilter>('ALL');
  const [mobileView, setMobileView] = useState<'queue' | 'panel'>('queue');
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<{ scopeKey: string; value: string }>({
    scopeKey: '',
    value: '',
  });
  const [overrideOpen, setOverrideOpen] = useState(false);
  const queueScrollTopRef = useRef(0);
  const queueSectionRef = useRef<HTMLElement | null>(null);
  const panelSectionRef = useRef<HTMLElement | null>(null);

  const { currentEventId, events, eventsQuery, selectedEvent, setSelectedEventId } = useAdminEventSelection();
  const gate = resolveEventControlGate('weighin', selectedEvent);
  const showContent = gate.mode === 'active';
  const eventId = showContent ? currentEventId : '';
  const athletesQuery = useWeighInAthletes({ eventId, search });
  const recordMutation = useRecordWeighIn(eventId);
  const reconcileMutation = useMutation({
    mutationFn: (registrationId: string) =>
      apiPost(`/api/weighin/${registrationId}/reconcile-category`, {
        reason: 'Reconcile missing category mapping from category code',
      }),
    onSuccess: () => {
      toast(t('reconcileCategorySuccess'));
      athletesQuery.refetch();
    },
    onError: (error) => {
      toast(getCompactErrorMessage(error, tC('error')), 'error');
    },
  });

  const filteredEntries = useMemo(
    () => (athletesQuery.data ?? []).filter((entry) => matchesQueueFilter(entry, filter)),
    [athletesQuery.data, filter],
  );

  const groupedQueue = useMemo(
    () =>
      buildWeighInQueueGroups(filteredEntries).map((group) => ({
        ...group,
        headingLabel: formatWeighInQueueGroupHeading(group, {
          maleDivisionLabel: t('queueDivisionMale'),
          femaleDivisionLabel: t('queueDivisionFemale'),
          unknownAgeLabel: t('queueUnknownAge'),
          unknownDivisionLabel: t('queueUnknownDivision'),
          unknownWeightLabel: t('queueUnknownWeight'),
        }),
      })),
    [filteredEntries, t],
  );

  const orderedEntries = useMemo(
    () => groupedQueue.flatMap((group) => group.entries),
    [groupedQueue],
  );
  const stats = useMemo(() => {
    const rows = athletesQuery.data ?? [];
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.weighInStatus === 'PASSED') acc.passed += 1;
        else if (row.weighInStatus === 'MOVED_UP') acc.moved += 1;
        else if (row.weighInStatus === 'FAILED' || row.weighInStatus === 'DISQUALIFIED')
          acc.failed += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: 0, passed: 0, pending: 0, moved: 0, failed: 0 },
    );
  }, [athletesQuery.data]);

  const resolvedSelectedRegistrationId = useMemo(() => {
    if (!orderedEntries.length) return null;
    if (
      selectedRegistrationId &&
      orderedEntries.some((row) => row.id === selectedRegistrationId)
    ) {
      return selectedRegistrationId;
    }
    return orderedEntries[0].id;
  }, [orderedEntries, selectedRegistrationId]);

  const selectedEntry = useMemo(
    () => orderedEntries.find((entry) => entry.id === resolvedSelectedRegistrationId) ?? null,
    [orderedEntries, resolvedSelectedRegistrationId],
  );

  const weightScopeKey = `${eventId}:${resolvedSelectedRegistrationId ?? ''}`;
  const weightInput = weightDraft.scopeKey === weightScopeKey ? weightDraft.value : '';

  const previewQuery = useWeighInDecisionPreview({
    registrationId: selectedEntry?.eventWeightCategory ? selectedEntry.id : null,
    weightInput,
  });

  const submitRecord = (payload: {
    decision?: WeighInDecision;
    reason?: string;
    nextEventWeightCategoryId?: string;
    override?: boolean;
  }) => {
    if (!selectedEntry?.eventWeightCategory) {
      toast(t('missingCategoryMappingWarning'), 'error');
      return;
    }
    const weightKg = normalizeWeight(weightInput);
    if (!selectedEntry || weightKg == null) {
      toast(t('weightValidation'), 'error');
      return;
    }

    recordMutation.mutate(
      {
        registrationId: selectedEntry.id,
        weightKg,
        decision: payload.decision,
        reason: payload.reason,
        nextEventWeightCategoryId: payload.nextEventWeightCategoryId,
        override: payload.override,
      },
      {
        onSuccess: () => {
          toast(t('recorded'));
          setOverrideOpen(false);
        },
        onError: (error) => {
          toast(getCompactErrorMessage(error, tC('error')), 'error');
        },
      },
    );
  };

  const lifecycleSteps: Array<{
    key: string;
    label: string;
    stage: 'REGISTRATION' | 'LOCKED' | 'WEIGHIN' | 'DRAW' | 'BRACKETS' | 'LIVE' | 'DONE';
  }> = [
    {
      key: 'reg',
      stage: 'REGISTRATION',
      label: tEvents('lifecycle.REG_OPEN'),
    },
    {
      key: 'lock',
      stage: 'LOCKED',
      label: tEvents('lifecycle.LOCKED'),
    },
    {
      key: 'weighin',
      stage: 'WEIGHIN',
      label: tEvents('lifecycle.WEIGHIN'),
    },
    {
      key: 'draw',
      stage: 'DRAW',
      label: tEvents('lifecycle.DRAWN'),
    },
    {
      key: 'brackets',
      stage: 'BRACKETS',
      label: tNav('brackets'),
    },
    {
      key: 'live',
      stage: 'LIVE',
      label: tEvents('lifecycle.LIVE'),
    },
    {
      key: 'done',
      stage: 'DONE',
      label: tC('done'),
    },
  ];

  const lifecycleStage: 'REGISTRATION' | 'LOCKED' | 'WEIGHIN' | 'DRAW' | 'BRACKETS' | 'LIVE' | 'DONE' =
    selectedEvent?.lifecycle === 'REG_OPEN'
      ? 'REGISTRATION'
      : selectedEvent?.lifecycle === 'LOCKED'
      ? 'LOCKED'
      : selectedEvent?.lifecycle === 'WEIGHIN' || selectedEvent?.lifecycle === 'WEIGH_IN_COMPLETED'
      ? 'WEIGHIN'
      : selectedEvent?.lifecycle === 'DRAWN'
      ? 'DRAW'
      : selectedEvent?.lifecycle === 'PUBLISHED'
      ? 'BRACKETS'
      : selectedEvent?.lifecycle === 'LIVE'
      ? 'LIVE'
      : 'DONE';

  const lifecycleIndex = lifecycleSteps.findIndex((step) => step.stage === lifecycleStage);
  const selectedAthleteName = selectedEntry
    ? `${selectedEntry.athlete.firstName} ${selectedEntry.athlete.lastName}`.trim()
    : '';

  const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 768;
  const scrollToSectionTop = (section: HTMLElement | null, topOverride?: number) => {
    if (typeof window === 'undefined') return;
    const top = typeof topOverride === 'number' ? topOverride : (section?.offsetTop ?? 0);
    window.scrollTo({ top, behavior: 'auto' });
  };

  const handleSelectAthlete = (id: string) => {
    const nextEntry = orderedEntries.find((entry) => entry.id === id) ?? null;
    const shouldUseMobileNav = isMobileViewport();

    if (shouldUseMobileNav) {
      queueScrollTopRef.current = window.scrollY;
    }

    setSelectedRegistrationId(id);
    setWeightDraft({ scopeKey: '', value: '' });
    setMobileView(shouldUseMobileNav ? 'panel' : 'queue');

    if (shouldUseMobileNav && nextEntry) {
      window.requestAnimationFrame(() => {
        scrollToSectionTop(panelSectionRef.current);
      });
    }
  };

  const handleBackToQueue = () => {
    setMobileView('queue');
    if (!isMobileViewport()) return;

    window.requestAnimationFrame(() => {
      scrollToSectionTop(queueSectionRef.current, queueScrollTopRef.current);
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <WeighInToolbar
        events={events}
        selectedEventId={currentEventId}
        search={search}
        filter={filter}
        showFilters={showContent}
        onEventChange={(nextId) => {
          setSelectedEventId(nextId);
          setSelectedRegistrationId(null);
          setWeightDraft({ scopeKey: '', value: '' });
          setMobileView('queue');
        }}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        t={(key) => t(key as Parameters<typeof t>[0])}
      />

      {currentEventId && gate.mode !== 'active' && (
        <EventPhaseGate
          gate={gate}
          locale={locale}
          t={(key, values) =>
            tGate(
              key as Parameters<typeof tGate>[0],
              values as Record<string, string | number | Date> | undefined,
            )
          }
          tEvents={(key) => tEventsGate(key as Parameters<typeof tEventsGate>[0])}
        />
      )}

      {showContent && (
        <section className="space-y-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lifecycleSteps.map((step, index) => (
              <div
                key={step.key}
                className={`shrink-0 rounded-[var(--radius-pill)] border px-2.5 py-1 text-[11px] font-semibold ${
                  index === lifecycleIndex
                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                    : index < lifecycleIndex
                    ? 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                }`}
              >
                {step.label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-5">
            <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-text)]">
              {t('filterAll')}: <span className="font-semibold">{stats.total}</span>
            </p>
            <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-success)]">
              {t('filterPassed')}: <span className="font-semibold">{stats.passed}</span>
            </p>
            <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-amber-300">
              {t('filterNeedsAction')}: <span className="font-semibold">{stats.pending}</span>
            </p>
            <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-primary)]">
              {t('filterMoved')}: <span className="font-semibold">{stats.moved}</span>
            </p>
            <p className="rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[var(--color-danger)]">
              {t('filterFailed')}: <span className="font-semibold">{stats.failed}</span>
            </p>
          </div>
        </section>
      )}

      {eventsQuery.error && (
        <AdminErrorAlert
          error={eventsQuery.error}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={() => eventsQuery.refetch()}
        />
      )}
      {showContent && athletesQuery.error && (
        <AdminErrorAlert
          error={athletesQuery.error}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={() => athletesQuery.refetch()}
        />
      )}

      {showContent && (
        <div className="relative overflow-hidden md:grid md:gap-4 md:grid-cols-[minmax(300px,40%)_minmax(0,60%)] md:items-start">
          <section
            ref={queueSectionRef}
            className={`min-w-0 space-y-3 transition-transform duration-[250ms] ease-out md:relative md:translate-x-0 md:opacity-100 md:pointer-events-auto ${
              mobileView === 'queue'
                ? 'relative translate-x-0 opacity-100 pointer-events-auto'
                : 'absolute inset-0 -translate-x-full opacity-0 pointer-events-none'
            }`}
          >
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('queueTitle')}
            </h2>
            <WeighInAthleteList
              groups={groupedQueue}
              selectedId={resolvedSelectedRegistrationId}
              isLoading={athletesQuery.isLoading}
              onSelect={handleSelectAthlete}
              t={(key) => t(key as Parameters<typeof t>[0])}
            />
          </section>

          <section
            ref={panelSectionRef}
            className={`space-y-3 border-0 transition-transform duration-[250ms] ease-out md:relative md:translate-x-0 md:opacity-100 md:pointer-events-auto md:sticky md:top-[calc(var(--topbar-height)+2rem)] md:self-start md:max-h-[calc(100vh-var(--topbar-height)-3rem)] md:overflow-y-auto md:border-l md:border-[var(--color-border)] md:pl-4 ${
              mobileView === 'panel'
                ? 'relative translate-x-0 opacity-100 pointer-events-auto'
                : 'absolute inset-0 translate-x-full opacity-0 pointer-events-none'
            }`}
          >
            <h2 className="hidden text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] md:block">
              {t('detailsTitle')}
            </h2>
            <div className="sticky top-[var(--topbar-height)] z-30 -mx-4 bg-[var(--color-bg)] px-4 py-3 md:hidden">
              <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={handleBackToQueue}
                  className="min-h-[44px] shrink-0 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
                >
                  {`\u2190 ${tC('back')} ${t('queueTitle')}`}
                </button>
                <p className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold text-[var(--color-text)]">
                  {selectedAthleteName}
                </p>
              </div>
            </div>
            <WeighInDetailsPanel
              selected={selectedEntry}
              preview={previewQuery.data ?? null}
              previewError={previewQuery.error}
              previewLoading={previewQuery.isFetching}
              weightInput={weightInput}
              recordError={recordMutation.error}
              isRecordPending={recordMutation.isPending}
              onWeightInputChange={(value) =>
                setWeightDraft({
                  scopeKey: weightScopeKey,
                  value,
                })
              }
              onRecord={(payload) => submitRecord(payload)}
              isReconcilingCategory={reconcileMutation.isPending}
              onReconcileCategory={() => {
                if (!selectedEntry) return;
                reconcileMutation.mutate(selectedEntry.id);
              }}
              onOpenOverride={() => setOverrideOpen(true)}
              isOverrideOpen={overrideOpen}
              t={(key, values) =>
                t(
                  key as Parameters<typeof t>[0],
                  values as Record<string, string | number | Date> | undefined,
                )
              }
              tC={(key) => tC(key as Parameters<typeof tC>[0])}
            />
          </section>
        </div>
      )}

      <WeighInOverrideDialog
        open={overrideOpen}
        categories={toCategories(selectedEntry)}
        isPending={recordMutation.isPending}
        onClose={() => setOverrideOpen(false)}
        onSubmit={(payload) =>
          submitRecord({
            ...payload,
            override: true,
          })
        }
        t={(key, values) =>
          t(
            key as Parameters<typeof t>[0],
            values as Record<string, string | number | Date> | undefined,
          )
        }
      />
    </div>
  );
}
