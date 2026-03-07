'use client';

import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import type { RegistrationRow } from '@/types/api';
import { athleteName } from './RegistrationTable';

type RowAction = 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface ConfirmModalState {
  reg: RegistrationRow;
  action: RowAction;
  reason: string;
}

interface Props {
  state: ConfirmModalState | null;
  isPending: boolean;
  t: (key: string) => string;
  tC: (key: string) => string;
  onChange: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function RegistrationConfirmModal({ state, isPending, t, tC, onChange, onClose, onConfirm }: Props) {
  if (!state) return null;

  const actionLabel =
    state.action === 'APPROVED' ? t('actions.approve')
    : state.action === 'REJECTED' ? t('actions.reject')
    : t('actions.withdraw');

  const title =
    state.action === 'APPROVED' ? t('confirmApprove')
    : state.action === 'REJECTED' ? t('confirmReject')
    : t('confirmWithdraw');

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={title}
      description={`${athleteName(state.reg)} · ${state.reg.club?.name ?? '—'} · ${state.reg.categoryCode}`}
    >
      <div className="space-y-4">
        {(state.action === 'REJECTED' || state.action === 'WITHDRAWN') && (
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              {t('reasonOptional')}
            </label>
            <input
              type="text"
              value={state.reason}
              onChange={(e) => onChange(e.target.value)}
              className="mt-1 h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`h-10 rounded-[var(--radius-input)] px-4 text-[13px] font-medium text-white disabled:opacity-70 ${
              state.action === 'APPROVED'
                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isPending ? tC('loading') : actionLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
