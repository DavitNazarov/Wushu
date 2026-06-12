'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { apiPost } from '@/lib/api/client';
import { localizedFullName } from '@/lib/bilingual';
import { getCompactErrorMessage } from '@/lib/api/error';
import { buildWeighInQueueGroups, formatWeighInQueueGroupHeading } from '@/lib/weighin/queue';
import type { WeighInDecision, WeighInQueueFilter } from '@/types/weighin';
import { WeighInToolbar } from '@/features/weighin/components/WeighInToolbar';
import { matchesQueueFilter } from '@/features/weighin/lib/weighInStatusFormatter';
import { useWeighInAthletes } from './useWeighInAthletes';
import { useWeighInDecisionPreview } from './useWeighInDecisionPreview';
import { useRecordWeighIn } from './useRecordWeighIn';
import { buildWeighInLifecycleSteps, resolveWeighInLifecycleStage } from './weighInLifecycle';
import { normalizeWeight, toWeighInCategories } from './weighInPage.utils';
import { WeighInWorkspace } from './WeighInWorkspace';

type Props = {
  eventId: string;
};

export function WeighInPageContainer({ eventId }: Props) {
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

  const { events, eventsQuery, selectedEvent, setSelectedEventId } = useAdminEventRoute({ eventId, page: 'weighin' });
  const gate = resolveEventControlGate('weighin', selectedEvent);
  const showContent = gate.mode === 'active';
  const activeEventId = showContent ? eventId : '';
  const athletesQuery = useWeighInAthletes({ eventId: activeEventId, search });
  const recordMutation = useRecordWeighIn(activeEventId);
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

  const orderedEntries = useMemo(() => groupedQueue.flatMap((group) => group.entries), [groupedQueue]);
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

  const weightScopeKey = `${activeEventId}:${resolvedSelectedRegistrationId ?? ''}`;
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

  const lifecycleSteps = buildWeighInLifecycleSteps(
    (key) => tEvents(key as Parameters<typeof tEvents>[0]),
    (key) => tNav(key as Parameters<typeof tNav>[0]),
    (key) => tC(key as Parameters<typeof tC>[0]),
  );
  const lifecycleStage = resolveWeighInLifecycleStage(selectedEvent?.lifecycle);
  const lifecycleIndex = lifecycleSteps.findIndex((step) => step.stage === lifecycleStage);
  const selectedAthleteName = selectedEntry
    ? localizedFullName(selectedEntry.athlete.firstName, selectedEntry.athlete.lastName, selectedEntry.athlete.firstNameKa, selectedEntry.athlete.lastNameKa, locale)
    : '';

  const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth < 768;

  // Land the panel with its top (sticky back bar + athlete header) pinned just under
  // the app top bar, so the athlete card is fully visible — not tucked under the bar
  // and not the page top. NOTE: offsetTop is relative to the offsetParent (the relative
  // grid container), not the document, so use absolute geometry instead.
  const scrollPanelIntoView = () => {
    if (typeof window === 'undefined') return;
    const panel = panelSectionRef.current;
    if (!panel) return;
    const topbarPx =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--topbar-height'),
        10,
      ) || 0;
    const panelTop = panel.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(panelTop - topbarPx, 0), behavior: 'auto' });
  };

  const handleSelectAthlete = (id: string) => {
    const shouldUseMobileNav = isMobileViewport();

    if (shouldUseMobileNav) {
      queueScrollTopRef.current = window.scrollY;
    }

    setSelectedRegistrationId(id);
    setWeightDraft({ scopeKey: '', value: '' });
    setMobileView(shouldUseMobileNav ? 'panel' : 'queue');

    if (shouldUseMobileNav) {
      window.requestAnimationFrame(scrollPanelIntoView);
    }
  };

  const handleBackToQueue = () => {
    setMobileView('queue');
    if (!isMobileViewport()) return;
    const restoreTop = queueScrollTopRef.current;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoreTop, behavior: 'auto' });
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <WeighInToolbar
        events={events}
        selectedEventId={eventId}
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

      <WeighInWorkspace
        currentEventId={eventId}
        gate={gate}
        showContent={showContent}
        locale={locale}
        eventsError={eventsQuery.error}
        onRetryEvents={() => eventsQuery.refetch()}
        athletesError={athletesQuery.error}
        onRetryAthletes={() => athletesQuery.refetch()}
        lifecycleSteps={lifecycleSteps}
        lifecycleIndex={lifecycleIndex}
        stats={stats}
        groupedQueue={groupedQueue}
        resolvedSelectedRegistrationId={resolvedSelectedRegistrationId}
        athletesLoading={athletesQuery.isLoading}
        selectedAthleteName={selectedAthleteName}
        selectedEntry={selectedEntry}
        preview={previewQuery.data ?? null}
        previewError={previewQuery.error}
        previewLoading={previewQuery.isFetching}
        weightInput={weightInput}
        recordError={recordMutation.error}
        isRecordPending={recordMutation.isPending}
        isReconcilingCategory={reconcileMutation.isPending}
        overrideOpen={overrideOpen}
        categories={toWeighInCategories(selectedEntry)}
        queueSectionRef={queueSectionRef}
        panelSectionRef={panelSectionRef}
        mobileView={mobileView}
        onSelectAthlete={handleSelectAthlete}
        onWeightInputChange={(value) =>
          setWeightDraft({
            scopeKey: weightScopeKey,
            value,
          })
        }
        onRecord={submitRecord}
        onReconcileCategory={() => {
          if (!selectedEntry) return;
          reconcileMutation.mutate(selectedEntry.id);
        }}
        onOpenOverride={() => setOverrideOpen(true)}
        onBackToQueue={handleBackToQueue}
        onCloseOverride={() => setOverrideOpen(false)}
        t={(key, values) =>
          t(
            key as Parameters<typeof t>[0],
            values as Record<string, string | number | Date> | undefined,
          )
        }
        tC={(key) => tC(key as Parameters<typeof tC>[0])}
        tGate={(key, values) =>
          tGate(
            key as Parameters<typeof tGate>[0],
            values as Record<string, string | number | Date> | undefined,
          )
        }
        tEvents={(key) => tEventsGate(key as Parameters<typeof tEventsGate>[0])}
      />
    </div>
  );
}
