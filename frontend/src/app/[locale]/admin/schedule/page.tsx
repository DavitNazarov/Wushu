'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import type { EventRow, MatRow, FightRow } from '@/types/api';

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function athleteName(a?: { firstName: string; lastName: string } | null) {
  return a ? `${a.firstName} ${a.lastName}` : 'BYE';
}

export default function SchedulePage() {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');
  const qc = useQueryClient();
  const { toast } = useToast();

  const [eventId, setEventId] = useState('');
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

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });
  const eid = eventId || events?.[0]?.id || '';

  const { data: mats } = useQuery({
    queryKey: ['mats', eid],
    queryFn: () => apiGet<MatRow[]>(`/api/mats?eventId=${eid}`),
    enabled: !!eid,
  });

  const { data: fights, isLoading, error, refetch } = useQuery({
    queryKey: ['schedule', eid],
    queryFn: () => apiGet<FightRow[]>(`/api/schedule?eventId=${eid}`),
    enabled: !!eid,
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
    onError: () => toast(t('errorGeneric'), 'error'),
  });

  const autoMut = useMutation({
    mutationFn: () => apiPost('/api/schedule/auto', { eventId: eid, ...autoForm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule', eid] });
      toast(t('scheduleUpdated'));
      setAutoOpen(false);
    },
    onError: () => toast(t('errorGeneric'), 'error'),
  });

  const fightsByMat = useMemo(
    () =>
      (mats ?? []).map((mat) => ({
        mat,
        fights: (fights ?? [])
          .filter((f) => f.matId === mat.id)
          .sort((a, b) => (a.orderInMat ?? 0) - (b.orderInMat ?? 0)),
      })),
    [mats, fights],
  );

  const unscheduledCount = useMemo(
    () => (fights ?? []).filter((f) => !f.matId).length,
    [fights],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <div className="flex gap-2">
            <select className={SEL} value={eid} onChange={(e) => setEventId(e.target.value)}>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
            <SecondaryButton onClick={() => { setMatName(''); setAddMatOpen(true); }}>
              {t('addMat')}
            </SecondaryButton>
            <PrimaryButton onClick={() => setAutoOpen(true)}>
              {t('autoSchedule')}
            </PrimaryButton>
          </div>
        }
      />

      {error && (
        <InlineAlert
          variant="error"
          actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {mats && mats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--color-text-muted)]">Mats:</span>
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

      {isLoading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : !fights?.length ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {fightsByMat.map(({ mat, fights: matFights }) => (
            <div key={mat.id} className="w-56 shrink-0">
              <div className="mb-2 rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text)]">
                {mat.name}
              </div>
              <div className="flex flex-col gap-2">
                {matFights.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="text-[11px] text-[var(--color-text-muted)]">
                      #{f.orderInMat}
                    </div>
                    <div className="mt-1 text-[13px] font-medium text-red-400">{athleteName(f.redAthlete)}</div>
                    <div className="text-[11px] text-[var(--color-text-muted)]">vs</div>
                    <div className="text-[13px] font-medium text-blue-400">{athleteName(f.blueAthlete)}</div>
                    {f.scheduledStartTime && (
                      <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                        {new Date(f.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                ))}
                {matFights.length === 0 && (
                  <p className="py-6 text-center text-[12px] text-[var(--color-text-muted)]">—</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
        <input className={`mt-1 ${INPUT}`} value={matName} onChange={(e) => setMatName(e.target.value)} placeholder="Mat 1" />
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
    </div>
  );
}
