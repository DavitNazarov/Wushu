'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { localizedName } from '@/lib/bilingual';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { ScheduleFightRow, ScheduleSessionRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import { useAdminEventRoute } from '@/features/admin-events/hooks/useAdminEventRoute';
import { AdminEventSelect } from '@/components/admin/AdminEventSelect';

const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type Props = { eventId: string };

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type DragFight = { fightId: string; fromSessionId: string };
type DropFightTarget = { sessionId: string; insertAfterOrder: number };

// ── Fight card ─────────────────────────────────────────────────────────────
function FightCard({
  fight,
  index,
  sessionId,
  isEditable,
  isGapViolation,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  fight: ScheduleFightRow;
  index: number;
  sessionId: string;
  isEditable: boolean;
  isGapViolation: boolean;
  isDragging: boolean;
  onDragStart: (fightId: string, fromSessionId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
  onDrop: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
}) {
  return (
    <div
      draggable={isEditable}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(fight.id, sessionId); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, sessionId, index); }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e, sessionId, index); }}
      className={`flex items-center gap-2 rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-3 py-2 text-[12px] transition
        ${isGapViolation ? 'border-[var(--color-warning)]' : 'border-[var(--color-border)]'}
        ${isDragging ? 'opacity-40' : ''}
        ${isEditable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[10px] font-bold text-[var(--color-text-muted)]">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--color-text)]">
          {localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} <span className="text-[var(--color-text-muted)]">vs</span> {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {fight.bracketRoundLabel} · #{fight.bracketFightNumber}
        </p>
      </div>
      {isGapViolation && (
        <span className="shrink-0 rounded-full bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
          ⚠ gap
        </span>
      )}
      {fight.liveStatus === 'RUNNING' && (
        <span className="shrink-0 rounded-full bg-[var(--color-primary)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
          LIVE
        </span>
      )}
    </div>
  );
}

function DropZone({
  sessionId,
  insertAfterOrder,
  active,
  onDragOver,
  onDrop,
}: {
  sessionId: string;
  insertAfterOrder: number;
  active: boolean;
  onDragOver: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
  onDrop: (e: React.DragEvent, sessionId: string, insertAfterOrder: number) => void;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver(e, sessionId, insertAfterOrder); }}
      onDrop={(e) => { e.stopPropagation(); onDrop(e, sessionId, insertAfterOrder); }}
      className={`mx-1 rounded transition-all duration-100 ${active ? 'h-1.5 bg-[var(--color-primary)]' : 'h-0.5 bg-transparent'}`}
    />
  );
}

export function SchedulePageClient({ eventId }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Session form
  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduleSessionRow | null>(null);
  const [sessionForm, setSessionForm] = useState({ name: '', startTime: '', endTime: '' });
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Generate modal
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({ avgBoutSeconds: 180, bufferSeconds: 60 });

  // Fight DnD
  const [dragFight, setDragFight] = useState<DragFight | null>(null);
  const [dropFightTarget, setDropFightTarget] = useState<DropFightTarget | null>(null);

  // Session DnD
  const [dragSessionId, setDragSessionId] = useState<string | null>(null);
  const [dropSessionTarget, setDropSessionTarget] = useState<string | null>(null);

  // Gap violations
  const [gapViolations, setGapViolations] = useState<Set<string>>(new Set());

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

  // ── Mutations ────────────────────────────────────────────────────────────

  const upsertSessionMut = useMutation({
    mutationFn: (data: { id?: string; name: string; startTime: string; endTime: string; order: number }) =>
      apiPost('/api/schedule-sessions', { eventId: eid, ...data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsQK });
      toast(t('sessionSaved'));
      setAddSessionOpen(false);
      setEditingSession(null);
      setSessionForm({ name: '', startTime: '', endTime: '' });
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const deleteSessionMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/schedule-sessions/${id}?eventId=${eid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionsQK });
      qc.invalidateQueries({ queryKey: scheduleQK });
      toast(t('sessionDeleted'));
      setDeleteSessionId(null);
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const generateMut = useMutation({
    mutationFn: () =>
      apiPost<{ sessionCount: number; fightCount: number; diagnostics: { fullySatisfied: boolean; conflictCount: number } }>(
        '/api/schedule/generate',
        { eventId: eid, ...generateForm },
      ),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: scheduleQK });
      qc.invalidateQueries({ queryKey: sessionsQK });
      setGapViolations(new Set());
      toast(
        result.diagnostics.fullySatisfied
          ? t('generated')
          : t('generatedWithConflicts', { count: result.diagnostics.conflictCount }),
        result.diagnostics.fullySatisfied ? 'success' : 'error',
      );
      setGenerateOpen(false);
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const moveFightMut = useMutation({
    mutationFn: (data: { fightId: string; toSessionId: string | null; insertAfterOrder: number }) =>
      apiPost<{ ok: boolean; gapViolations: string[] }>('/api/schedule/move-session-fight', data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: scheduleQK });
      setGapViolations(new Set(result.gapViolations));
      if (result.gapViolations.length > 0) toast(t('gapWarning'), 'error');
    },
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  const reorderSessionsMut = useMutation({
    mutationFn: (sessionIds: string[]) =>
      apiPost('/api/schedule/reorder-sessions', { eventId: eid, sessionIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionsQK }),
    onError: (e) => toast(getCompactErrorMessage(e, t('errorGeneric')), 'error'),
  });

  // ── Session helpers ───────────────────────────────────────────────────────

  function openAddSession() {
    setEditingSession(null);
    setSessionForm({ name: '', startTime: '', endTime: '' });
    setAddSessionOpen(true);
  }

  function openEditSession(s: ScheduleSessionRow) {
    setEditingSession(s);
    const toLocal = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setSessionForm({ name: s.name, startTime: toLocal(s.startTime), endTime: toLocal(s.endTime) });
    setAddSessionOpen(true);
  }

  function submitSession() {
    upsertSessionMut.mutate({
      id: editingSession?.id,
      name: sessionForm.name,
      startTime: new Date(sessionForm.startTime).toISOString(),
      endTime: new Date(sessionForm.endTime).toISOString(),
      order: editingSession?.order ?? sortedSessions.length + 1,
    });
  }

  // ── Fight DnD ─────────────────────────────────────────────────────────────

  function onFightDragStart(fightId: string, fromSessionId: string) {
    setDragFight({ fightId, fromSessionId });
  }

  function onFightDragEnd() {
    setDragFight(null);
    setDropFightTarget(null);
  }

  function onFightDragOver(_e: React.DragEvent, sessionId: string, insertAfterOrder: number) {
    if (dragFight) setDropFightTarget({ sessionId, insertAfterOrder });
  }

  function onFightDrop(_e: React.DragEvent, sessionId: string, insertAfterOrder: number) {
    if (!dragFight) return;
    moveFightMut.mutate({ fightId: dragFight.fightId, toSessionId: sessionId, insertAfterOrder });
    setDragFight(null);
    setDropFightTarget(null);
  }

  // ── Session DnD ───────────────────────────────────────────────────────────

  function onSessionDragEnd() {
    if (dragSessionId && dropSessionTarget && dragSessionId !== dropSessionTarget) {
      const ids = sortedSessions.map((s) => s.id);
      const fromIdx = ids.indexOf(dragSessionId);
      const toIdx = ids.indexOf(dropSessionTarget);
      if (fromIdx !== -1 && toIdx !== -1) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, dragSessionId);
        reorderSessionsMut.mutate(ids);
      }
    }
    setDragSessionId(null);
    setDropSessionTarget(null);
  }

  const hasSessions = sortedSessions.length > 0;
  const totalScheduled = (fights ?? []).filter((f) => f.isScheduled).length;
  const totalPlayable = (fights ?? []).filter((f) => f.isPlayable).length;

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
            {isEditable && (
              <>
                <SecondaryButton onClick={openAddSession}>{t('addSession')}</SecondaryButton>
                <PrimaryButton
                  disabled={!hasSessions || totalPlayable === 0}
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
          {/* Stats */}
          <div className="flex items-center gap-3 text-[12px] text-[var(--color-text-muted)]">
            <span>{totalScheduled}/{totalPlayable} {t('scheduled').toLowerCase()}</span>
            {fightsBySession.unassigned.length > 0 && (
              <span className="text-[var(--color-warning)]">
                {fightsBySession.unassigned.length} {t('unscheduled').toLowerCase()}
              </span>
            )}
          </div>

          {/* Sessions */}
          {sortedSessions.map((session) => {
            const sessionFights = fightsBySession.map.get(session.id) ?? [];
            const isSessionDropTarget = dragSessionId && dropSessionTarget === session.id;

            return (
              <div
                key={session.id}
                draggable={isEditable && !dragFight}
                onDragStart={(e) => { if (isEditable && !dragFight) { e.stopPropagation(); setDragSessionId(session.id); }}}
                onDragEnd={onSessionDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragSessionId) setDropSessionTarget(session.id);
                }}
                className={`rounded-[var(--radius-card)] border transition
                  ${isSessionDropTarget ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-[var(--color-border)] bg-[var(--color-surface-alt)]'}
                  ${dragSessionId === session.id ? 'opacity-50' : ''}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {isEditable && (
                      <span className="select-none text-[var(--color-text-muted)]">⠿</span>
                    )}
                    <span className="text-[13px] font-semibold text-[var(--color-text)]">{session.name}</span>
                    <span className="text-[12px] text-[var(--color-text-muted)]">
                      {fmt(session.startTime)} – {fmt(session.endTime)}
                    </span>
                    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                      {sessionFights.length}
                    </span>
                  </div>
                  {isEditable && (
                    <div className="flex gap-3">
                      <button onClick={() => openEditSession(session)} className="text-[12px] text-[var(--color-primary)] hover:underline">
                        {tCommon('edit')}
                      </button>
                      <button onClick={() => setDeleteSessionId(session.id)} className="text-[12px] text-[var(--color-danger)] hover:underline">
                        {tCommon('delete')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Fight list */}
                <div
                  className="space-y-1 px-4 pb-3"
                  onDragOver={(e) => { e.preventDefault(); if (dragFight && sessionFights.length === 0) setDropFightTarget({ sessionId: session.id, insertAfterOrder: 0 }); }}
                  onDrop={(e) => { if (dragFight && sessionFights.length === 0) onFightDrop(e, session.id, 0); }}
                >
                  {isEditable && dragFight && (
                    <DropZone
                      sessionId={session.id}
                      insertAfterOrder={0}
                      active={dropFightTarget?.sessionId === session.id && dropFightTarget.insertAfterOrder === 0}
                      onDragOver={onFightDragOver}
                      onDrop={onFightDrop}
                    />
                  )}

                  {sessionFights.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-[var(--color-text-muted)]">{t('emptySession')}</p>
                  ) : (
                    sessionFights.map((fight, idx) => (
                      <div key={fight.id}>
                        <FightCard
                          fight={fight}
                          index={idx}
                          sessionId={session.id}
                          isEditable={isEditable}
                          isGapViolation={gapViolations.has(fight.id)}
                          isDragging={dragFight?.fightId === fight.id}
                          onDragStart={onFightDragStart}
                          onDragEnd={onFightDragEnd}
                          onDragOver={onFightDragOver}
                          onDrop={onFightDrop}
                        />
                        {isEditable && dragFight && (
                          <DropZone
                            sessionId={session.id}
                            insertAfterOrder={idx + 1}
                            active={dropFightTarget?.sessionId === session.id && dropFightTarget.insertAfterOrder === idx + 1}
                            onDragOver={onFightDragOver}
                            onDrop={onFightDrop}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned */}
          {fightsBySession.unassigned.length > 0 && (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-4">
              <p className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)]">
                {t('unscheduled')} ({fightsBySession.unassigned.length})
              </p>
              <div className="space-y-1">
                {fightsBySession.unassigned.map((fight) => (
                  <div key={fight.id} className="flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12px]">
                    <span className="font-semibold text-[var(--color-text)]">{localizedName(fight.redDisplayName, fight.redDisplayNameKa, locale)} vs {localizedName(fight.blueDisplayName, fight.blueDisplayNameKa, locale)}</span>
                    <span className="text-[var(--color-text-muted)]">{fight.bracketRoundLabel} · #{fight.bracketFightNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {isEditable && (
        <>
          {/* Add / Edit session modal */}
          <Modal
            open={addSessionOpen}
            onClose={() => { setAddSessionOpen(false); setEditingSession(null); }}
            title={editingSession ? t('editSession') : t('addSession')}
            description={t('addSessionDesc')}
            footer={
              <>
                <SecondaryButton onClick={() => { setAddSessionOpen(false); setEditingSession(null); }}>{tCommon('cancel')}</SecondaryButton>
                <PrimaryButton
                  disabled={!sessionForm.name.trim() || !sessionForm.startTime || !sessionForm.endTime || upsertSessionMut.isPending}
                  onClick={submitSession}
                >
                  {upsertSessionMut.isPending ? tCommon('loading') : tCommon('save')}
                </PrimaryButton>
              </>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionName')}</label>
                <input className={INPUT} value={sessionForm.name} onChange={(e) => setSessionForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('sessionNamePlaceholder')} />
              </div>
              <div>
                <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionStart')}</label>
                <input type="datetime-local" className={INPUT} value={sessionForm.startTime} onChange={(e) => setSessionForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionEnd')}</label>
                <input type="datetime-local" className={INPUT} value={sessionForm.endTime} onChange={(e) => setSessionForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
          </Modal>

          {/* Delete session modal */}
          <Modal
            open={!!deleteSessionId}
            onClose={() => setDeleteSessionId(null)}
            title={t('deleteSessionTitle')}
            description={t('deleteSessionDesc')}
            footer={
              <>
                <SecondaryButton onClick={() => setDeleteSessionId(null)}>{tCommon('cancel')}</SecondaryButton>
                <PrimaryButton disabled={deleteSessionMut.isPending} onClick={() => deleteSessionId && deleteSessionMut.mutate(deleteSessionId)}>
                  {deleteSessionMut.isPending ? tCommon('loading') : tCommon('delete')}
                </PrimaryButton>
              </>
            }
          >
            <p className="text-[13px] text-[var(--color-text-muted)]">{t('deleteSessionWarning')}</p>
          </Modal>

          {/* Generate modal */}
          <Modal
            open={generateOpen}
            onClose={() => setGenerateOpen(false)}
            title={t('generateSchedule')}
            description={t('generateScheduleDesc')}
            footer={
              <>
                <SecondaryButton onClick={() => setGenerateOpen(false)}>{tCommon('cancel')}</SecondaryButton>
                <PrimaryButton disabled={generateMut.isPending} onClick={() => generateMut.mutate()}>
                  {generateMut.isPending ? tCommon('loading') : t('generate')}
                </PrimaryButton>
              </>
            }
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('avgBoutSeconds')}</label>
                <input type="number" className={INPUT} value={generateForm.avgBoutSeconds} onChange={(e) => setGenerateForm((f) => ({ ...f, avgBoutSeconds: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('bufferSeconds')}</label>
                <input type="number" className={INPUT} value={generateForm.bufferSeconds} onChange={(e) => setGenerateForm((f) => ({ ...f, bufferSeconds: Number(e.target.value) }))} />
              </div>
              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
                {t('gapRuleNote')}
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
