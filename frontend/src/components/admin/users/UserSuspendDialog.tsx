'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

function toLocalDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type Props = {
  open: boolean;
  pending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: (payload: {
    reason: string;
    startAt: string;
    endAt: string;
    note: string | null;
  }) => void;
};

export function UserSuspendDialog({
  open,
  pending,
  errorMessage,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [reason, setReason] = useState('');
  const [startAt, setStartAt] = useState(toLocalDateTimeValue(now));
  const [endAt, setEndAt] = useState(toLocalDateTimeValue(defaultEnd));
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleClose() {
    setReason('');
    setStartAt(toLocalDateTimeValue(new Date()));
    setEndAt(toLocalDateTimeValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    setNote('');
    setValidationError(null);
    onClose();
  }

  function handleConfirm() {
    setValidationError(null);

    if (!reason.trim()) {
      setValidationError(t('details.reasonRequired'));
      return;
    }

    if (new Date(endAt) <= new Date(startAt)) {
      setValidationError(t('details.invalidSuspendRange'));
      return;
    }

    onConfirm({
      reason: reason.trim(),
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      note: note.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('details.suspendTitle')}
      description={t('details.suspendDescription')}
      footer={
        <>
          <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            className="bg-amber-500 text-black hover:bg-amber-400"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? tCommon('loading') : t('details.suspendAction')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {(validationError || errorMessage) && (
          <InlineAlert variant="error">
            {validationError ?? errorMessage}
          </InlineAlert>
        )}

        <div>
          <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
            {t('details.reason')}
          </label>
          <textarea
            className="min-h-24 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
              {t('details.startAt')}
            </label>
            <input
              className={INPUT_CLASS}
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
              {t('details.endAt')}
            </label>
            <input
              className={INPUT_CLASS}
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
            {t('details.note')}
          </label>
          <textarea
            className="min-h-20 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
