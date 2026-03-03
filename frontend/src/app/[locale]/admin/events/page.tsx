'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

type EventLifecycle =
  | 'REG_OPEN'
  | 'WEIGHIN'
  | 'LOCKED'
  | 'DRAWN'
  | 'PUBLISHED'
  | 'LIVE'
  | 'COMPLETED';

type EventRow = {
  id: string;
  name: string;
  lifecycle: EventLifecycle;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
};

type FetchState = 'idle' | 'loading' | 'error';

export default function EventsPage() {
  const tAdmin = useTranslations('admin');
  const tEvents = useTranslations('admin.events');
  const tAdvance = useTranslations('admin.events.advance');

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setFetchState('loading');
      try {
        const response = await fetch('/api/events', { method: 'GET', credentials: 'include' });
        if (!response.ok) {
          throw new Error('FETCH_FAILED');
        }
        const data = (await response.json()) as EventRow[];
        if (!cancelled) {
          setEvents(data);
          setFetchState('idle');
        }
      } catch {
        if (!cancelled) {
          setFetchState('error');
        }
      }
    }

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const nextLifecycle = useMemo<EventLifecycle | null>(() => {
    if (!selectedEvent) return null;
    const order: EventLifecycle[] = ['REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED'];
    const index = order.indexOf(selectedEvent.lifecycle);
    if (index === -1 || index === order.length - 1) return null;
    return order[index + 1] ?? null;
  }, [selectedEvent]);

  function getLifecycleBadgeVariant(lifecycle: EventLifecycle) {
    if (lifecycle === 'LIVE') return 'success' as const;
    if (lifecycle === 'COMPLETED') return 'default' as const;
    if (lifecycle === 'WEIGHIN' || lifecycle === 'LOCKED') return 'warning' as const;
    return 'default' as const;
  }

  function formatDateRange(start: string | null, end: string | null) {
    if (!start && !end) return '—';
    const from = start ? new Date(start).toLocaleDateString() : null;
    const to = end ? new Date(end).toLocaleDateString() : null;
    if (from && to && from !== to) {
      return `${from} – ${to}`;
    }
    return from ?? to ?? '—';
  }

  function handleOpenAdvanceDialog() {
    setAdvanceError(null);
    setReason('');
    setIsAdvanceDialogOpen(true);
  }

  async function handleConfirmAdvance() {
    if (!selectedEvent || !nextLifecycle) {
      setIsAdvanceDialogOpen(false);
      return;
    }

    setIsAdvancing(true);
    setAdvanceError(null);

    try {
      const response = await fetch(`/api/events/${selectedEvent.id}/lifecycle`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetState: nextLifecycle,
          reason: reason.trim() || null,
          override: false,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        if (payload.error === 'INVALID_EVENT_TRANSITION') {
          setAdvanceError(tAdvance('errorInvalidTransition'));
        } else if (payload.error === 'OVERRIDE_REASON_REQUIRED') {
          setAdvanceError(tAdvance('errorOverrideReasonRequired'));
        } else {
          setAdvanceError(tAdvance('errorGeneric'));
        }
        setIsAdvancing(false);
        return;
      }

      const updated = (await response.json()) as EventRow;
      setEvents((current) => current.map((event) => (event.id === updated.id ? updated : event)));
      setIsAdvancing(false);
      setIsAdvanceDialogOpen(false);
    } catch {
      setAdvanceError(tAdvance('errorGeneric'));
      setIsAdvancing(false);
    }
  }

  const hasEvents = events.length > 0;

  return (
    <AppShell title={tAdmin('events.title')}>
      <div className="space-y-6">
        <SectionHeader
          title={tAdmin('events.title')}
          action={
            <PrimaryButton
              disabled={!selectedEvent || !nextLifecycle}
              onClick={selectedEvent && nextLifecycle ? handleOpenAdvanceDialog : undefined}
            >
              {tAdvance('button')}
            </PrimaryButton>
          }
        />
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {tAdmin('dashboard.linkEventsDescription')}
        </p>

        {!hasEvents && fetchState !== 'loading' && (
          <EmptyState
            title={tAdmin('events.emptyTitle')}
            description={tAdmin('events.emptyDescription')}
          />
        )}

        {fetchState === 'error' && (
          <p className="text-[13px] text-[var(--color-danger)]">{tAdvance('errorGeneric')}</p>
        )}

        {hasEvents && (
          <div className="space-y-3">
            <Table>
              <TableHead>
                <TableHeader>{tEvents('columns.name')}</TableHeader>
                <TableHeader>{tEvents('columns.dates')}</TableHeader>
                <TableHeader>{tEvents('columns.location')}</TableHeader>
                <TableHeader>{tEvents('columns.lifecycle')}</TableHeader>
              </TableHead>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-[var(--color-text)]">{event.name}</span>
                      </div>
                    </TableCell>
                    <TableCell muted>{formatDateRange(event.startDate, event.endDate)}</TableCell>
                    <TableCell muted>{event.location || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={getLifecycleBadgeVariant(event.lifecycle)}>
                        {tEvents(`lifecycle.${event.lifecycle}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!selectedEvent && (
              <p className="text-[12px] text-[var(--color-text-muted)]">{tAdvance('noEventSelected')}</p>
            )}
          </div>
        )}

        {isAdvanceDialogOpen && selectedEvent && nextLifecycle && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="w-full max-w-md rounded-[var(--radius-modal)] bg-[var(--color-surface)] p-6 shadow-xl">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {tAdvance('dialogTitle')}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {tAdvance('dialogDescription')}
              </p>

              <div className="mt-4 space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--color-text-muted)]">{tAdvance('currentStage')}</span>
                  <Badge variant={getLifecycleBadgeVariant(selectedEvent.lifecycle)}>
                    {tEvents(`lifecycle.${selectedEvent.lifecycle}`)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--color-text-muted)]">{tAdvance('nextStage')}</span>
                  <Badge variant={getLifecycleBadgeVariant(nextLifecycle)}>
                    {tEvents(`lifecycle.${nextLifecycle}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <label className="block text-[13px] font-medium text-[var(--color-text)]">
                  {tAdvance('reasonLabel')}
                </label>
                <textarea
                  className="mt-1 h-20 w-full resize-none rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>

              {advanceError && (
                <p className="mt-3 text-[13px] text-[var(--color-danger)]">{advanceError}</p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]/80"
                  onClick={() => {
                    if (!isAdvancing) {
                      setIsAdvanceDialogOpen(false);
                    }
                  }}
                >
                  {tAdvance('cancel')}
                </button>
                <PrimaryButton
                  className="h-10 px-4 text-[13px]"
                  disabled={isAdvancing}
                  onClick={() => {
                    void handleConfirmAdvance();
                  }}
                >
                  {isAdvancing ? tAdmin('dashboard.quickLinks') : tAdvance('confirm')}
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

