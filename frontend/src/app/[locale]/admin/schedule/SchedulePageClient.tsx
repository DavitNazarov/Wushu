'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { apiGet, apiBlob, downloadBlob } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useToast } from '@/components/ui/Toast';
import type { ScheduleFightRow, ScheduleSessionRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { AdminEventSelect } from '@/components/admin/AdminEventSelect';

import {
  DEFAULT_GENERATE_FORM,
  EMPTY_SESSION_FORM,
  type GenerateFormState,
  type SessionFormState,
} from './schedule.types';
import { isoToLocalInput } from './schedule.utils';
import { computeScheduleIssues, type ScheduleIssue } from './schedule.gaps';
import { buildBoutNumbering } from './schedule.display';
import { useScheduleMutations } from './hooks/useScheduleMutations';
import { useFightDragDrop } from './hooks/useFightDragDrop';
import { useSessionDragDrop } from './hooks/useSessionDragDrop';
import { SessionCard } from './components/SessionCard';
import { UnscheduledList } from './components/UnscheduledList';
import { SessionFormModal } from './components/SessionFormModal';
import { DeleteSessionModal } from './components/DeleteSessionModal';
import { GenerateScheduleModal } from './components/GenerateScheduleModal';

type Props = { eventId: string };

export function SchedulePageClient({ eventId }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const { toast } = useToast();

  // Session form
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSessionRow | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionFormState>(EMPTY_SESSION_FORM);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Generate modal
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState<GenerateFormState>(DEFAULT_GENERATE_FORM);

  // Print
  const [printing, setPrinting] = useState(false);

  // Rest-gap check is opt-in: warnings only render after the admin asks for them.
  const [showGaps, setShowGaps] = useState(false);

  const { events, selectedEvent, setSelectedEventId } = useAdminEventRoute({ eventId, page: 'schedule' });
  const eid = eventId;
  const gate = resolveEventControlGate('schedule', selectedEvent);
  const showContent = gate.mode === 'active' || gate.mode === 'readonly';
  const isEditable = gate.mode === 'active';

  const scheduleQK = useMemo(() => ['schedule', eid] as const, [eid]);
  const sessionsQK = useMemo(() => ['schedule-sessions', eid] as const, [eid]);

  const { data: sessions } = useQuery({
    queryKey: sessionsQK,
    queryFn: () => apiGet<ScheduleSessionRow[]>(`/api/schedule-sessions?eventId=${eid}`),
    enabled: !!eid && showContent,
  });

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: scheduleQK,
    queryFn: () => apiGet<ScheduleFightRow[]>(`/api/schedule?eventId=${eid}`),
    enabled: !!eid && showContent,
  });

  useRealtimeQuerySync({
    scope: 'admin-schedule',
    eventId: eid || null,
    enabled: !!eid && showContent,
    queryKeys: [scheduleQK, sessionsQK],
  });

  const sortedSessions = useMemo(
    () => [...(sessions ?? [])].sort((a, b) => a.order - b.order),
    [sessions],
  );

  const fightsBySession = useMemo(() => {
    const map = new Map<string, ScheduleFightRow[]>();
    const unassigned: ScheduleFightRow[] = [];
    for (const f of fights ?? []) {
      if (f.sessionId && f.orderInSession != null) {
        const arr = map.get(f.sessionId) ?? [];
        arr.push(f);
        map.set(f.sessionId, arr);
      } else if (f.isPlayable) {
        unassigned.push(f);
      }
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.orderInSession ?? 0) - (b.orderInSession ?? 0));
    return { map, unassigned };
  }, [fights]);

  // Continuous bout numbering across the whole running order (sessions in
  // order, then orderInSession), so the badge and every "Winner of N" label
  // reference the same number instead of a per-session 1-based index.
  const boutNumbering = useMemo(() => {
    const ordered = sortedSessions.flatMap((s) => fightsBySession.map.get(s.id) ?? []);
    return buildBoutNumbering(ordered);
  }, [sortedSessions, fightsBySession]);

  // Schedule issues — red ordering errors (a bout fed by a later bout) + yellow
  // per-session rest-gap warnings. Opt-in via the toggle, and page-only: never
  // sent to the backend or shown in any PDF.
  const issues = useMemo(() => {
    if (!showGaps) return new Map<string, ScheduleIssue[]>();
    const perSession = sortedSessions.map((s) => fightsBySession.map.get(s.id) ?? []);
    return computeScheduleIssues(perSession);
  }, [showGaps, sortedSessions, fightsBySession]);

  const mutations = useScheduleMutations(
    eid,
    { scheduleQK, sessionsQK },
    {
      onSessionSaved: () => {
        setAddSessionOpen(false);
        setEditingSession(null);
        setSessionForm(EMPTY_SESSION_FORM);
      },
      onSessionDeleted: () => setDeleteSessionId(null),
      onGenerated: () => setGenerateOpen(false),
    },
    generateForm,
  );

  const fightDnd = useFightDragDrop((data) => mutations.moveFight.mutate(data));
  const sessionDnd = useSessionDragDrop(sortedSessions, (ids) => mutations.reorderSessions.mutate(ids));

  function openAddSession() {
    setEditingSession(null);
    setSessionForm(EMPTY_SESSION_FORM);
    setAddSessionOpen(true);
  }

  function openEditSession(s: ScheduleSessionRow) {
    setEditingSession(s);
    setSessionForm({
      name: s.name,
      nameKa: s.nameKa ?? '',
      startTime: isoToLocalInput(s.startTime),
      endTime: isoToLocalInput(s.endTime),
    });
    setAddSessionOpen(true);
  }

  function submitSession() {
    mutations.upsertSession.mutate({
      id: editingSession?.id,
      name: sessionForm.name,
      nameKa: sessionForm.nameKa.trim() || null,
      startTime: new Date(sessionForm.startTime).toISOString(),
      endTime: new Date(sessionForm.endTime).toISOString(),
      order: editingSession?.order ?? sortedSessions.length + 1,
    });
  }

  function closeSessionForm() {
    setAddSessionOpen(false);
    setEditingSession(null);
  }

  const hasSessions = sortedSessions.length > 0;
  const totalScheduled = (fights ?? []).filter((f) => f.isScheduled).length;
  // Every row getSchedule returns is schedule-visible (incl. "Winner of N"
  // placeholders), so the denominator is the full count, not just playable.
  const totalFights = (fights ?? []).length;
  // Fights not yet placed in a session — the only ones "Generate Schedule"
  // touches. Generating leaves already-scheduled fights untouched, so the
  // button is pointless (and disabled) once everything is assigned.
  const pendingCount = (fights ?? []).filter(
    (f) =>
      (f.sessionId == null || f.orderInSession == null) &&
      (f.status === 'QUEUED' || f.status === 'ON_DECK'),
  ).length;

  // Download the same server-rendered schedule PDF the results page exports,
  // so the printed document and the on-screen schedule stay identical.
  async function handlePrint() {
    if (!eid || printing) return;
    setPrinting(true);
    try {
      const lang = locale === 'ka' ? 'ka' : 'en';
      const blob = await apiBlob(`/api/exports/${eid}/schedule.pdf?lang=${lang}`);
      downloadBlob(blob, `schedule-${lang}.pdf`);
    } catch (e) {
      toast(getCompactErrorMessage(e, tCommon('error')), 'error');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <AdminEventSelect
              label={t('title')}
              value={eid}
              placeholder={t('title')}
              events={events}
              onValueChange={setSelectedEventId}
              className="min-w-[14rem]"
            />
            {showContent && hasSessions && (
              <SecondaryButton onClick={handlePrint} disabled={printing}>
                {printing ? tCommon('loading') : t('printSchedule')}
              </SecondaryButton>
            )}
            {showContent && hasSessions && (
              <SecondaryButton
                onClick={() => setShowGaps((v) => !v)}
                className={
                  showGaps
                    ? 'border-[var(--color-warning)] text-[var(--color-warning)]'
                    : ''
                }
              >
                {showGaps ? t('hideGaps') : t('checkGaps')}
              </SecondaryButton>
            )}
            {isEditable && (
              <>
                <SecondaryButton onClick={openAddSession}>{t('addSession')}</SecondaryButton>
                <PrimaryButton
                  disabled={!hasSessions || pendingCount === 0}
                  onClick={() => setGenerateOpen(true)}
                >
                  {t('generateSchedule')}
                </PrimaryButton>
              </>
            )}
          </div>
        }
      />

      {eid && gate.mode !== 'active' && (
        <EventPhaseGate
          gate={gate}
          locale={locale}
          t={(key, values) => tGate(key as Parameters<typeof tGate>[0], values as Record<string, string | number | Date> | undefined)}
          tEvents={(key) => tEvents(key as Parameters<typeof tEvents>[0])}
        />
      )}

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      {showContent && isLoading ? (
        <SkeletonRows rows={4} cols={2} />
      ) : showContent && !hasSessions ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : showContent ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
            <span>{totalScheduled}/{totalFights} {t('scheduled').toLowerCase()}</span>
            {fightsBySession.unassigned.length > 0 && (
              <span className="text-[var(--color-warning)]">
                {fightsBySession.unassigned.length} {t('unscheduled').toLowerCase()}
              </span>
            )}
            {showGaps && issues.size === 0 && (
              <span className="text-[var(--color-success)]">{t('noGaps')}</span>
            )}
          </div>

          {sortedSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              fights={fightsBySession.map.get(session.id) ?? []}
              locale={locale}
              isEditable={isEditable}
              numbering={boutNumbering}
              issues={issues}
              dragFight={fightDnd.dragFight}
              dropFightTarget={fightDnd.dropFightTarget}
              dragSessionId={sessionDnd.dragSessionId}
              isSessionDropTarget={!!sessionDnd.dragSessionId && sessionDnd.dropSessionTarget === session.id}
              onSessionDragStart={() => sessionDnd.onSessionDragStart(session.id)}
              onSessionDragEnd={sessionDnd.onSessionDragEnd}
              onSessionDragOver={() => sessionDnd.onSessionDragOver(session.id)}
              onEdit={() => openEditSession(session)}
              onDelete={() => setDeleteSessionId(session.id)}
              onFightDragStart={fightDnd.onFightDragStart}
              onFightDragEnd={fightDnd.onFightDragEnd}
              onFightDragOver={fightDnd.onFightDragOver}
              onFightDrop={fightDnd.onFightDrop}
            />
          ))}

          <UnscheduledList fights={fightsBySession.unassigned} locale={locale} />
        </div>
      ) : null}

      {isEditable && (
        <>
          <SessionFormModal
            open={addSessionOpen}
            isEditing={!!editingSession}
            form={sessionForm}
            setForm={setSessionForm}
            saving={mutations.upsertSession.isPending}
            fightDays={selectedEvent?.dates?.fightDays ?? []}
            onClose={closeSessionForm}
            onSubmit={submitSession}
          />
          <DeleteSessionModal
            open={!!deleteSessionId}
            deleting={mutations.deleteSession.isPending}
            onClose={() => setDeleteSessionId(null)}
            onConfirm={() => deleteSessionId && mutations.deleteSession.mutate(deleteSessionId)}
          />
          <GenerateScheduleModal
            open={generateOpen}
            form={generateForm}
            setForm={setGenerateForm}
            running={mutations.generate.isPending}
            onClose={() => setGenerateOpen(false)}
            onSubmit={() => mutations.generate.mutate()}
          />
        </>
      )}
    </div>
  );
}
