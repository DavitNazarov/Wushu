'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';
import { apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { toWeighInCategoryList } from '@/lib/weighin/category';
import { Link } from '@/i18n/navigation';
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
  const tPublic = useTranslations('public');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const pathname = usePathname();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WeighInQueueFilter>('ALL');
  const [mobileTab, setMobileTab] = useState<'queue' | 'active'>('queue');
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<{ scopeKey: string; value: string }>({
    scopeKey: '',
    value: '',
  });
  const [overrideOpen, setOverrideOpen] = useState(false);

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

  return (
    <div className="space-y-4 pb-24 md:pb-0">
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
        <div className="md:hidden">
          <div className="mb-3 grid grid-cols-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <button
              type="button"
              onClick={() => setMobileTab('queue')}
              className={`min-h-[44px] rounded-[var(--radius-pill)] px-3 text-[13px] font-semibold ${
                mobileTab === 'queue'
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {t('queueTitle')}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('active')}
              className={`min-h-[44px] rounded-[var(--radius-pill)] px-3 text-[13px] font-semibold ${
                mobileTab === 'active'
                  ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {t('detailsTitle')}
            </button>
          </div>
        </div>
      )}

      {showContent && (
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,40%)_minmax(0,60%)] lg:items-start">
        <section className={`min-w-0 space-y-3 ${mobileTab === 'active' ? 'hidden md:block' : ''}`}>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('queueTitle')}
          </h2>
          <WeighInAthleteList
            groups={groupedQueue}
            selectedId={resolvedSelectedRegistrationId}
            isLoading={athletesQuery.isLoading}
            onSelect={(id) => {
              setSelectedRegistrationId(id);
              setWeightDraft({ scopeKey: '', value: '' });
              setMobileTab('active');
            }}
            t={(key) => t(key as Parameters<typeof t>[0])}
          />
        </section>

        <section
          className={`space-y-3 border-0 lg:sticky lg:top-[calc(var(--topbar-height)+2rem)] lg:self-start lg:max-h-[calc(100vh-var(--topbar-height)-3rem)] lg:overflow-y-auto lg:border-l lg:border-[var(--color-border)] lg:pl-4 ${
            mobileTab === 'queue' ? 'hidden md:block' : ''
          }`}
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('detailsTitle')}
          </h2>
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('queue')}
              className="min-h-[44px] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
            >
              {tC('back')}
            </button>
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

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 md:hidden">
        <ul className="grid grid-cols-5 gap-1 text-center">
          {[
            { href: '/admin', label: tPublic('overview') },
            { href: '/admin/weighin', label: tNav('weighin') },
            { href: '/admin/draw', label: tNav('draw') },
            { href: '/admin/live', label: tNav('live') },
            { href: '/admin/settings', label: tPublic('more') },
          ].map((item) => {
            const active = pathname === `/${locale}${item.href}`;
            const href =
                  currentEventId && item.href !== '/admin'
                    ? `${item.href}?eventId=${encodeURIComponent(currentEventId)}`
                    : item.href;
            return (
              <li key={item.href}>
                <Link
                  href={href}
                  className={`flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] px-1 text-[12px] font-semibold ${
                    active
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
