'use client';

import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Globe, Hash } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusChip } from '@/components/ui/StatusChip';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, EventLifecycle } from '@/types/api';
import { EditEventModal } from '../EditEventModal';
import { EventStageStepper, STEPPER_STAGES } from '@/components/event/EventStageStepper';
import { DatesCard } from './DatesCard';
import { EventAdvanceModal } from './EventAdvanceModal';
import { useState } from 'react';

const LIFECYCLE_ORDER: EventLifecycle[] = [
  'REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED',
];

function nextLifecycle(current: EventLifecycle): EventLifecycle | null {
  const idx = LIFECYCLE_ORDER.indexOf(current);
  return idx >= 0 && idx < LIFECYCLE_ORDER.length - 1 ? LIFECYCLE_ORDER[idx + 1] : null;
}

interface EventSummaryResponse {
  event: EventRow;
  summary: { totalRegistrations: number; byStatus: Record<string, number>; totalAthletes: number; totalClubs: number };
}

const REG_STATUSES = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const;
const QUICK_LINKS = ['registrations', 'weighin', 'draw', 'brackets', 'schedule', 'live'] as const;

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tEvents = useTranslations('admin.events');
  const tDetail = useTranslations('admin.events.detail');
  const tAdvance = useTranslations('admin.events.advance');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reason, setReason] = useState('');

  const runAutomationMutation = useMutation({
    // Per-event endpoint: checks, advances if needed, returns fresh event+summary.
    mutationFn: () => apiPost<EventSummaryResponse>(`/api/events/${id}/run-automation`, {}),
    onSuccess: (fresh) => {
      // Populate cache directly so UI updates instantly (no extra round-trip).
      queryClient.setQueryData(['event-detail', id], fresh);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      const advanced = fresh.event.lifecycle === 'WEIGHIN' && event?.lifecycle === 'REG_OPEN';
      toast(advanced ? tEvents('autoAdvanceStage.advanced') : tEvents('autoAdvanceStage.noChange'));
    },
    onError: () => toast(tCommon('saveFailed'), 'error'),
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-detail', id],
    queryFn: () => apiGet<EventSummaryResponse>(`/api/events/${id}/summary`),
    enabled: !!id,
  });

  const event = data?.event;
  const summary = data?.summary;
  const next = event ? nextLifecycle(event.lifecycle) : null;

  const advanceMutation = useMutation({
    mutationFn: () =>
      apiPost<EventRow>(`/api/events/${id}/lifecycle`, { targetState: next, reason: reason.trim() || null, override: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tAdvance('success'));
      setAdvanceOpen(false);
      setReason('');
    },
    onError: (err) => {
      let msg = tAdvance('errorGeneric');
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_EVENT_TRANSITION') msg = tAdvance('errorInvalidTransition');
        else if (err.code === 'REGISTRATION_STILL_OPEN') msg = tAdvance('errorRegistrationOpen');
        else if (err.code === 'COMPETITION_NOT_STARTED') msg = tAdvance('errorCompetitionNotStarted');
      }
      toast(msg, 'error');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (published: boolean) => apiPost<EventRow>(`/api/events/${id}/publish`, { published }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tCommon('saveSuccess'));
    },
    onError: () => toast(tCommon('saveFailed'), 'error'),
  });

  if (isLoading) return <div className="space-y-6"><SkeletonRows rows={4} cols={3} /></div>;

  if (error || !event) {
    return (
      <InlineAlert variant="error" actions={
        <button onClick={() => refetch()} className="text-[13px] font-medium underline">{tCommon('retry')}</button>
      }>
        {tCommon('loadError')}
      </InlineAlert>
    );
  }

  const cardCls = 'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4';
  const sectionHeadCls = 'mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]';

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
            <h1 className="text-[22px] font-bold leading-tight text-[var(--color-text)]">{event.name}</h1>
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
            {next && (
              <PrimaryButton onClick={() => { setReason(''); setAdvanceOpen(true); }}>
                {tAdvance('button')}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>

      {/* Lifecycle stepper */}
      <div className={cardCls}>
        <EventStageStepper
          stage={event.lifecycle}
          labels={Object.fromEntries(
            STEPPER_STAGES.map((s) => [
              s,
              tEvents(`lifecycleShort.${s}` as Parameters<typeof tEvents>[0]),
            ]),
          ) as Record<EventLifecycle, string>}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label={tDetail('kpiRegistrations')} value={summary?.totalRegistrations ?? 0} />
        <KpiCard label={tDetail('kpiAthletes')} value={summary?.totalAthletes ?? 0} />
        <KpiCard label={tDetail('kpiClubs')} value={summary?.totalClubs ?? 0} />
        <KpiCard label={tDetail('kpiApproved')} value={summary?.byStatus['APPROVED'] ?? 0} color="var(--color-success)" />
      </div>

      {/* Two-column content */}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Dates */}
          <div className={cardCls}>
            <DatesCard event={event} />
          </div>

          {/* Registration breakdown */}
          {summary && summary.totalRegistrations > 0 && (
            <div className={cardCls}>
              <h2 className={sectionHeadCls}>{tDetail('regBreakdownTitle')}</h2>
              <div className="flex flex-wrap gap-3">
                {REG_STATUSES.map((s) => {
                  const count = summary.byStatus[s] ?? 0;
                  if (!count) return null;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <StatusChip status={s} label={s} domain="registration" />
                      <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Event meta */}
          <div className={cardCls}>
            <h2 className={sectionHeadCls}>{tDetail('detailsTitle')}</h2>
            <div className="space-y-2.5 text-[13px]">
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                  <span className="text-[var(--color-text)]">{event.location}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                <span className="text-[var(--color-text)]">{event.timezone}</span>
              </div>
              <div className="flex items-start gap-2">
                <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{event.slug}</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className={cardCls}>
            <h2 className={sectionHeadCls}>{tDetail('quickLinksTitle')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map((section) => (
                <button
                  key={section}
                  onClick={() => router.push(`/${locale}/admin/${section}?eventId=${id}`)}
                  className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[12px] font-medium text-[var(--color-text)] transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
                >
                  {tDetail(`link_${section}` as Parameters<typeof tDetail>[0])}
                  <span className="text-[var(--color-text-muted)]">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EditEventModal open={editOpen} onClose={() => setEditOpen(false)} event={event} />

      <EventAdvanceModal
        open={advanceOpen}
        onClose={() => setAdvanceOpen(false)}
        currentLifecycle={event.lifecycle}
        nextLifecycle={next}
        reason={reason}
        onReasonChange={setReason}
        isPending={advanceMutation.isPending}
        onConfirm={() => advanceMutation.mutate()}
        tAdvance={(key) => tAdvance(key as Parameters<typeof tAdvance>[0])}
        tEvents={(key) => tEvents(key as Parameters<typeof tEvents>[0])}
        tCommon={(key) => tCommon(key as Parameters<typeof tCommon>[0])}
      />
    </div>
  );
}
