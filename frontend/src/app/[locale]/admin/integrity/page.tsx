'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { resolveEventControlGate } from '@/domain/events/controlPageGate';
import { useAdminEventSelection } from '@/hooks/useAdminEventSelection';
import { AdminEventSelect } from '@/components/admin/AdminEventSelect';

type IntegrityIssue = {
  code: string;
  count: number;
  sampleIds: string[];
};

const SEL =
  'h-10 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function formatIntegrityCodeLabel(
  t: ReturnType<typeof useTranslations<'integrity'>>,
  code: string,
): string {
  const key = `codes.${code}` as const;
  const translated = t(key);
  if (translated !== key) return translated;

  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function IntegrityPage() {
  const t = useTranslations('integrity');
  const tCommon = useTranslations('common');
  const tGate = useTranslations('eventPhaseGate');
  const tEvents = useTranslations('admin.events');
  const locale = useLocale();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [lockOpen, setLockOpen] = useState(false);
  const [reason, setReason] = useState('');

  const { currentEventId, events, selectedEvent, setSelectedEventId } = useAdminEventSelection();
  const eid = currentEventId;
  const gate = resolveEventControlGate('integrity', selectedEvent);
  const showContent = gate.mode === 'active' || gate.mode === 'readonly';
  const canLockEvent = gate.mode === 'active' && selectedEvent?.lifecycle === 'WEIGHIN';

  const { data: issues, isLoading, error, refetch } = useQuery({
    queryKey: ['integrity', eid],
    queryFn: () => apiGet<IntegrityIssue[]>(`/api/integrity?eventId=${eid}`),
    enabled: !!eid && showContent,
  });

  const lockMut = useMutation({
    mutationFn: () =>
      apiPost('/api/integrity/lock', {
        eventId: eid,
        override: hasIssues,
        reason: reason.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrity', eid] });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event-detail', eid] });
      toast(t('lockSuccess'));
      setLockOpen(false);
      setReason('');
    },
    onError: (err) => {
      let msg = t('lockError');
      if (err instanceof ApiError) msg = err.message;
      else msg = getCompactErrorMessage(err, t('lockError'));
      toast(msg, 'error');
    },
  });

  const hasIssues = (issues?.length ?? 0) > 0;
  const canLock = !hasIssues || (hasIssues && reason.trim().length >= 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <AdminEventSelect
              label={t('title')}
              value={eid}
              placeholder={t('title')}
              events={events}
              onValueChange={setSelectedEventId}
              className="min-w-[14rem]"
            />
            {canLockEvent && (
              <PrimaryButton
                disabled={!eid || isLoading}
                onClick={() => {
                  setReason('');
                  setLockOpen(true);
                }}
              >
                {t('lock')}
              </PrimaryButton>
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

      {!eid ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : showContent && isLoading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : showContent && hasIssues ? (
        <div className="space-y-3">
          {issues!.map((issue) => (
            <div
              key={issue.code}
              className="flex items-start gap-4 rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-surface)] p-4"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                  {formatIntegrityCodeLabel(t, issue.code)}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">
                  {issue.count} {t('issueCount')}
                </p>
                {issue.sampleIds.length > 0 && (
                  <p className="mt-1 text-[11px] font-mono text-[var(--color-text-muted)]">
                    {t('sampleIds')}: {issue.sampleIds.slice(0, 3).join(', ')}
                    {issue.sampleIds.length > 3 && '…'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : showContent ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/40 bg-[var(--color-surface)] p-5">
          <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--color-text)]">{t('noIssues')}</p>
            <p className="text-[12px] text-[var(--color-text-muted)]">{t('noIssuesDescription')}</p>
          </div>
        </div>
      ) : null}

      {canLockEvent && (
        <Modal
          open={lockOpen}
          onClose={() => setLockOpen(false)}
          title={t('lockModal.title')}
          description={t('lockModal.description')}
          footer={
            <>
              <SecondaryButton onClick={() => setLockOpen(false)}>{tCommon('cancel')}</SecondaryButton>
              <PrimaryButton
                disabled={lockMut.isPending || !canLock}
                onClick={() => lockMut.mutate()}
              >
                {lockMut.isPending ? tCommon('loading') : t('lockModal.confirm')}
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-4">
            {hasIssues && (
              <InlineAlert variant="warning">{t('lockModal.issueWarning')}</InlineAlert>
            )}
            {hasIssues && (
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
                  {t('lockModal.reason')}
                </label>
                <input
                  className={INPUT}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={tCommon('reasonRequired')}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
