'use client';

import { StatusChip } from '@/components/ui/StatusChip';
import type { RegistrationRow } from '@/types/api';
import {
  canApplyRegistrationAction,
  type RowAction,
} from './registrationStatusActions';

const TD = 'px-4 py-3';
const TH = 'px-4 py-3 text-left font-medium text-[var(--color-text-muted)]';
const SMALL_BTN = '!h-7 !px-2 text-[11px]';

export function athleteName(reg: RegistrationRow): string {
  return reg.athlete ? `${reg.athlete.firstName} ${reg.athlete.lastName}`.trim() : reg.athleteId;
}

export function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

interface ActionButtonProps {
  label: string;
  variant: 'default' | 'danger';
  disabled: boolean;
  tooltip?: string;
  onClick: () => void;
}

function ActionButton({ label, variant, disabled, tooltip, onClick }: ActionButtonProps) {
  const btn = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={tooltip}
      className={`${SMALL_BTN} rounded border px-2 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'danger'
          ? 'border-red-500/50 text-red-500 hover:bg-red-500/10'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]'
      }`}
    >
      {label}
    </button>
  );
  return disabled && tooltip ? <span title={tooltip} className="inline-block">{btn}</span> : btn;
}

interface RegistrationTableProps {
  rows: RegistrationRow[];
  isLocked: boolean | null | undefined;
  t: (key: string) => string;
  onAction: (reg: RegistrationRow, action: RowAction) => void;
}

export function RegistrationTable({ rows, isLocked, t, onAction }: RegistrationTableProps) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="bg-[var(--color-surface-alt)]">
              <th className={TH}>{t('columns.athlete')}</th>
              <th className={TH}>{t('columns.club')}</th>
              <th className={TH}>{t('columns.category')}</th>
              <th className={TH}>{t('columns.status')}</th>
              <th className={TH}>{t('columns.notes')}</th>
              <th className={TH}>{t('columns.updated')}</th>
              <th className={TH}>{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((reg) => (
              <tr key={reg.id} className="bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]">
                <td className={`${TD} font-medium text-[var(--color-text)]`}>{athleteName(reg)}</td>
                <td className={`${TD} text-[var(--color-text-muted)]`}>{reg.club?.name ?? '—'}</td>
                <td className={`${TD} text-[var(--color-text)]`}>{reg.categoryCode}</td>
                <td className={TD}>
                  <StatusChip
                    status={reg.status}
                    label={t(`status.${reg.status}`)}
                    domain="registration"
                  />
                </td>
                <td className={`${TD} max-w-[120px] truncate text-[var(--color-text-muted)]`} title={reg.notes ?? undefined}>
                  {reg.notes ?? '—'}
                </td>
                <td className={TD} title={reg.updatedAt ? new Date(reg.updatedAt).toLocaleString() : undefined}>
                  {reg.updatedAt ? formatRelative(reg.updatedAt) : '—'}
                </td>
                <td className={TD}>
                  {reg.status === 'WITHDRAWN' ? (
                    <span className="text-[12px] text-[var(--color-text-muted)]">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <ActionButton label={t('actions.approve')} variant="default"
                        disabled={!!isLocked || !canApplyRegistrationAction('APPROVED', reg.status)}
                        onClick={() => onAction(reg, 'APPROVED')} />
                      <ActionButton label={t('actions.reject')} variant="danger"
                        disabled={!!isLocked || !canApplyRegistrationAction('REJECTED', reg.status)}
                        onClick={() => onAction(reg, 'REJECTED')} />
                      <ActionButton label={t('actions.withdraw')} variant="danger"
                        disabled={!!isLocked || !canApplyRegistrationAction('WITHDRAWN', reg.status)}
                        onClick={() => onAction(reg, 'WITHDRAWN')} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-2 sm:hidden">
        {rows.map((reg) => (
          <div key={reg.id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-medium text-[var(--color-text)]">{athleteName(reg)}</p>
              <StatusChip status={reg.status} label={t(`status.${reg.status}`)} domain="registration" />
            </div>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              {reg.club?.name ?? '—'} · {reg.categoryCode}
            </p>
            {reg.notes && (
              <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">{reg.notes}</p>
            )}
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              {reg.updatedAt ? formatRelative(reg.updatedAt) : ''}
            </p>
            {reg.status !== 'WITHDRAWN' && (
              <div className="mt-3 flex flex-wrap gap-1">
                <ActionButton label={t('actions.approve')} variant="default"
                  disabled={!!isLocked || !canApplyRegistrationAction('APPROVED', reg.status)}
                  onClick={() => onAction(reg, 'APPROVED')} />
                <ActionButton label={t('actions.reject')} variant="danger"
                  disabled={!!isLocked || !canApplyRegistrationAction('REJECTED', reg.status)}
                  onClick={() => onAction(reg, 'REJECTED')} />
                <ActionButton label={t('actions.withdraw')} variant="danger"
                  disabled={!!isLocked || !canApplyRegistrationAction('WITHDRAWN', reg.status)}
                  onClick={() => onAction(reg, 'WITHDRAWN')} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
