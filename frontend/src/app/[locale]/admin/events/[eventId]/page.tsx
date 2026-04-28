'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/primitives/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { localizedName } from '@/lib/bilingual';
import { EditEventModal } from '@/features/events/components/EditEventModal';
import type { EventRow, EventLifecycle } from '@/types/api';
import { EVENT_LIFECYCLE_ORDER, nextEventLifecycle } from '@/domain/events/lifecycle';
import { EventAdvanceDialog } from './_components/EventAdvanceDialog';
import { EventRevertDialog } from './_components/EventRevertDialog';
import { EventDatesCard } from './_components/EventDatesCard';
import { EventMetaCard } from './_components/EventMetaCard';
import { EventQuickLinksCard } from './_components/EventQuickLinksCard';
import { EventRegistrationBreakdownCard } from './_components/EventRegistrationBreakdownCard';

interface EventSummaryResponse {
  event: EventRow;
  summary: { totalRegistrations: number; byStatus: Record<string, number>; totalAthletes: number; totalClubs: number };
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tEvents = useTranslations('admin.events');
  const tDetail = useTranslations('admin.events.detail');
  const tAdvance = useTranslations('admin.events.advance');
  const tRevert = useTranslations('admin.events.revert');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceOverride, setAdvanceOverride] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertTarget, setRevertTarget] = useState<EventLifecycle | null>(null);

  const runAutomationMutation = useMutation({
    mutationFn: () =>
      apiPost<EventSummaryResponse>(`/api/events/${eventId}/run-automation`, {}),
    onSuccess: (fresh) => {
      queryClient.setQueryData(['event-detail', eventId], fresh);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      const advanced = Boolean(event && fresh.event.lifecycle !== event.lifecycle);
      toast(advanced ? tEvents('autoAdvanceStage.advanced') : tEvents('autoAdvanceStage.noChange'));
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-detail', eventId],
    queryFn: () => apiGet<EventSummaryResponse>(`/api/events/${eventId}/summary`),
    enabled: !!eventId,
  });

  const event = data?.event;
  const summary = data?.summary;
  const next = event ? nextEventLifecycle(event.lifecycle) : null;

  const advanceMutation = useMutation({
    mutationFn: () =>
      apiPost<EventRow>(`/api/events/${eventId}/lifecycle`, {
        targetState: next,
        reason: advanceReason.trim() || null,
        override: advanceOverride,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tAdvance('success'));
      setAdvanceOpen(false);
      setAdvanceReason('');
      setAdvanceOverride(false);
    },
    onError: (err) => {
      let msg = tAdvance('errorGeneric');
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_EVENT_TRANSITION') msg = tAdvance('errorInvalidTransition');
        else if (err.code === 'REGISTRATION_STILL_OPEN') msg = tAdvance('errorRegistrationOpen');
        else if (err.code === 'COMPETITION_NOT_STARTED') msg = tAdvance('errorCompetitionNotStarted');
        else if (err.code === 'OVERRIDE_REASON_REQUIRED') msg = tAdvance('errorOverrideReasonRequired');
      }
      toast(msg, 'error');
    },
  });

  const revertMutation = useMutation({
    mutationFn: () =>
      apiPost<EventRow>(`/api/events/${eventId}/lifecycle`, {
        targetState: revertTarget,
        reason: revertReason.trim(),
        override: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tRevert('success'));
      setRevertOpen(false);
      setRevertReason('');
      setRevertTarget(null);
    },
    onError: (err) => {
      let msg = tRevert('errorGeneric');
      if (err instanceof ApiError) {
        if (err.code === 'OVERRIDE_REASON_REQUIRED') msg = tAdvance('errorOverrideReasonRequired');
      }
      toast(msg, 'error');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (published: boolean) =>
      apiPost<EventRow>(`/api/events/${eventId}/publish`, { published }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tCommon('saveSuccess'));
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  if (isLoading) return <div className="space-y-6"><SkeletonRows rows={4} cols={3} /></div>;

  if (error || !event) {
    return (
      <AdminErrorAlert
        error={error ?? new Error('EVENT_NOT_FOUND')}
        fallbackMessage={tCommon('loadError')}
        retryLabel={tCommon('retry')}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push(`/${locale}/admin/events`)}
          className="mb-2 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← {tCommon('back')}
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-[var(--color-text)]">{localizedName(event.name, event.nameKa, locale)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip
                status={event.lifecycle}
                label={tEvents(`lifecycle.${event.lifecycle}` as Parameters<typeof tEvents>[0])}
                domain="lifecycle"
              />
              {event.published && (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[12px] font-medium text-emerald-400">
                  {tDetail('published')}
                </span>
              )}
              {event.autoAdvanceStage ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/15 px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-primary)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                  {tEvents('autoAdvanceStage.badge')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--color-text-muted)]">
                  {tEvents('autoAdvanceStage.badgeOff')}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                  <MapPin className="h-3 w-3" />{event.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <SecondaryButton onClick={() => setEditOpen(true)}>{tCommon('edit')}</SecondaryButton>
            <SecondaryButton disabled={publishMutation.isPending} onClick={() => publishMutation.mutate(!event.published)}>
              {event.published ? tCommon('unpublish') : tCommon('publish')}
            </SecondaryButton>
            {event.autoAdvanceStage && (
              <SecondaryButton
                disabled={runAutomationMutation.isPending}
                onClick={() => runAutomationMutation.mutate()}
              >
                {runAutomationMutation.isPending ? tCommon('loading') : tEvents('autoAdvanceStage.runNow')}
              </SecondaryButton>
            )}
            {EVENT_LIFECYCLE_ORDER.length > 1 && (
              <button
                onClick={() => {
                  setRevertReason('');
                  setRevertTarget(null);
                  setRevertOpen(true);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]"
              >
                ⇄ {tRevert('button')}
              </button>
            )}
            {next && (
              <PrimaryButton
                onClick={() => {
                  setAdvanceReason('');
                  setAdvanceOverride(false);
                  setAdvanceOpen(true);
                }}
              >
                {tAdvance('button')}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>

      {/* Lifecycle stepper */}
      <Card className="p-4">
        <EventStageStepper
          stage={event.lifecycle}
          labels={Object.fromEntries(
            STEPPER_STAGES.map((s) => [
              s,
              tEvents(`lifecycleShort.${s}` as Parameters<typeof tEvents>[0]),
            ]),
          ) as Record<EventLifecycle, string>}
        />
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={tDetail('kpiRegistrations')} value={summary?.totalRegistrations ?? 0} />
        <KpiCard label={tDetail('kpiAthletes')} value={summary?.totalAthletes ?? 0} />
        <KpiCard label={tDetail('kpiClubs')} value={summary?.totalClubs ?? 0} />
        <KpiCard label={tDetail('kpiApproved')} value={summary?.byStatus['APPROVED'] ?? 0} color="var(--color-success)" />
      </div>

      {/* Two-column content */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <EventDatesCard event={event} />
          {summary && summary.totalRegistrations > 0 && (
            <EventRegistrationBreakdownCard byStatus={summary.byStatus} />
          )}
        </div>
        <div className="space-y-4">
          <EventMetaCard event={event} />
          <EventQuickLinksCard eventId={eventId} />
        </div>
      </div>

      <EditEventModal open={editOpen} onClose={() => setEditOpen(false)} event={event} />

      <EventAdvanceDialog
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        currentLifecycle={event.lifecycle}
        nextLifecycle={next}
        reason={advanceReason}
        onReasonChange={setAdvanceReason}
        override={advanceOverride}
        onOverrideChange={setAdvanceOverride}
        isPending={advanceMutation.isPending}
        onConfirm={() => advanceMutation.mutate()}
      />

      <EventRevertDialog
        open={revertOpen}
        onClose={() => setRevertOpen(false)}
        currentLifecycle={event.lifecycle}
        targetLifecycle={revertTarget}
        onTargetChange={setRevertTarget}
        reason={revertReason}
        onReasonChange={setRevertReason}
        isPending={revertMutation.isPending}
        onConfirm={() => revertMutation.mutate()}
      />
    </div>
  );
}
