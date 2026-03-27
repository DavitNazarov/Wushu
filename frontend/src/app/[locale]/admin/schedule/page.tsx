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
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type {
  AutoScheduleResponse,
  MatRow,
  ScheduleFightRow,
} from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';
import { useRealtimeQuerySync } from '@/hooks/useRealtimeQuerySync';
import { ScheduleFightGrid } from './ScheduleFightGrid';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export default function SchedulePage() {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [addMatOpen, setAddMatOpen] = useState(false);
  const [matName, setMatName] = useState('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoForm, setAutoForm] = useState(() => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T09:00`;
    return { startTimeIso: defaultStart, avgBoutSeconds: 180, bufferSeconds: 60, restMinutes: 30 };
  });

  const { currentEventId, events, selectedEvent, setSelectedEventId } = useAdminEventSelection();
  const eid = currentEventId;
  const gate = resolveEventControlGate('schedule', selectedEvent);
  const showContent = gate.mode === 'active' || gate.mode === 'readonly';
  const isEditable = gate.mode === 'active';
  const scheduleQueryKey = useMemo(() => ['schedule', eid] as const, [eid]);

  const { data: mats } = useQuery({
    queryKey: ['mats', eid],
    queryFn: () => apiGet<MatRow[]>(`/api/mats?eventId=${eid}`),
    enabled: !!eid && showContent,
  });

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: scheduleQueryKey,
    queryFn: () => apiGet<ScheduleFightRow[]>(`/api/schedule?eventId=${eid}`),
    enabled: !!eid && showContent,
  });
  useRealtimeQuerySync({
    scope: 'admin-schedule',
    eventId: eid || null,
    enabled: !!eid && showContent,
    queryKeys: [scheduleQueryKey],
  });

  const addMatMut = useMutation({
    mutationFn: () =>
      apiPost('/api/mats', { eventId: eid, name: matName, order: (mats?.length ?? 0) + 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mats', eid] });
      toast(t('matAdded'));
      setAddMatOpen(false);
      setMatName('');
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, t('errorGeneric')), 'error'),
  });

  const autoMut = useMutation({
    mutationFn: () =>
      apiPost<AutoScheduleResponse>('/api/schedule/auto', {
        eventId: eid,
        ...autoForm,
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['schedule', eid] });
      toast(
        result.diagnostics.fullySatisfied
          ? t('scheduleUpdated')
          : t('scheduleUpdatedWithConflicts', {
              count: result.diagnostics.conflictCount,
            }),
        result.diagnostics.fullySatisfied ? 'success' : 'error',
      );
      setAutoOpen(false);
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, t('errorGeneric')), 'error'),
  });

  const scheduleFlow = useMemo(
    () => {
      const matOrderById = new Map((mats ?? []).map((mat) => [mat.id, mat.order]));
      return [...(fights ?? [])].sort((left, right) => {
        const leftScheduled = left.matId != null && left.orderInMat != null;
        const rightScheduled = right.matId != null && right.orderInMat != null;
        if (leftScheduled !== rightScheduled) return leftScheduled ? -1 : 1;

        if (leftScheduled && rightScheduled) {
          const matOrderLeft = left.matId ? (matOrderById.get(left.matId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          const matOrderRight = right.matId ? (matOrderById.get(right.matId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          if (matOrderLeft !== matOrderRight) return matOrderLeft - matOrderRight;
          return (left.orderInMat ?? Number.MAX_SAFE_INTEGER) - (right.orderInMat ?? Number.MAX_SAFE_INTEGER);
        }

        return (left.scheduleOrder ?? Number.MAX_SAFE_INTEGER) - (right.scheduleOrder ?? Number.MAX_SAFE_INTEGER);
      });
    },
    [fights, mats],
  );

  const unscheduledCount = useMemo(
    () => (fights ?? []).filter((f) => f.isPlayable && !f.matId).length,
    [fights],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex gap-2">
            <select className={SEL} value={eid} onChange={(e) => setSelectedEventId(e.target.value)}>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
            {isEditable && (
              <>
                <SecondaryButton onClick={() => { setMatName(''); setAddMatOpen(true); }}>
                  {t('addMat')}
                </SecondaryButton>
                <PrimaryButton onClick={() => setAutoOpen(true)}>
                  {t('autoSchedule')}
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
          t={(key, values) =>
            tGate(
              key as Parameters<typeof tGate>[0],
              values as Record<string, string | number | Date> | undefined,
            )
          }
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

      {showContent && mats && mats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-text-muted)]">
            {t('matsLabel')}:
          </span>
          {mats.map((m) => (
            <span
              key={m.id}
              className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-1 text-[12px] font-semibold text-[var(--color-text)]"
            >
              {m.name}
            </span>
          ))}
          {unscheduledCount > 0 && (
            <span className="text-[12px] text-[var(--color-warning)]">
              {unscheduledCount} {t('unscheduled').toLowerCase()}
            </span>
          )}
        </div>
      )}

      {showContent && isLoading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : showContent && !scheduleFlow.length ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : showContent ? (
        <ScheduleFightGrid
          fights={scheduleFlow}
          fightReadyLabel={t('fightReady')}
          fightWaitingLabel={t('fightWaiting')}
        />
      ) : null}

      {isEditable && (
        <>
          <Modal
            open={addMatOpen}
            onClose={() => setAddMatOpen(false)}
            title={t('addMat')}
            description={t('addMatDesc')}
            footer={
              <>
                <SecondaryButton onClick={() => setAddMatOpen(false)}>{tCommon('cancel')}</SecondaryButton>
                <PrimaryButton disabled={!matName.trim() || addMatMut.isPending} onClick={() => addMatMut.mutate()}>
                  {addMatMut.isPending ? tCommon('loading') : tCommon('create')}
                </PrimaryButton>
              </>
            }
          >
            <label className="block text-[13px] font-medium text-[var(--color-text)]">{t('matName')}</label>
            <input
              className={`mt-1 ${INPUT}`}
              value={matName}
              onChange={(e) => setMatName(e.target.value)}
              placeholder={t('matPlaceholder')}
            />
          </Modal>

          <Modal
            open={autoOpen}
            onClose={() => setAutoOpen(false)}
            title={t('autoSchedule')}
            description={t('autoScheduleDesc')}
            footer={
              <>
                <SecondaryButton onClick={() => setAutoOpen(false)}>{tCommon('cancel')}</SecondaryButton>
                <PrimaryButton disabled={autoMut.isPending || !autoForm.startTimeIso} onClick={() => autoMut.mutate()}>
                  {autoMut.isPending ? tCommon('loading') : t('autoSchedule')}
                </PrimaryButton>
              </>
            }
          >
            <div className="space-y-3">
              {([
                { label: t('startTime'), key: 'startTimeIso', type: 'datetime-local' },
                { label: t('avgBout'), key: 'avgBoutSeconds', type: 'number' },
                { label: t('buffer'), key: 'bufferSeconds', type: 'number' },
                { label: t('restMinutes'), key: 'restMinutes', type: 'number' },
              ] as const).map(({ label, key, type }) => (
                <div key={key}>
                  <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{label}</label>
                  <input
                    type={type}
                    className={INPUT}
                    value={autoForm[key]}
                    onChange={(e) =>
                      setAutoForm((f) => ({
                        ...f,
                        [key]: type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
