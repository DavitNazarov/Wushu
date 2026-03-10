'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { useAdminUser } from '@/hooks/useAdminUser';
import {
  useArchiveAdminUser,
  useRemoveAdminUserSuspension,
  useSuspendAdminUser,
  useUpdateAdminUser,
} from '@/hooks/useAdminUserMutations';
import { useToast } from '@/components/ui/Toast';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { UserStatusBadge } from './UserStatusBadge';
import { UserEditForm } from './UserEditForm';
import { UserSuspendDialog } from './UserSuspendDialog';
import { UserActionDialog } from './UserActionDialog';
import { UserDetailItem } from './UserDetailItem';

type Props = {
  userId: string | null;
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
};

export function UserDetailsDrawer({ userId, currentUserId, open, onClose }: Props) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();
  const userQuery = useAdminUser(userId);
  const updateMutation = useUpdateAdminUser();
  const suspendMutation = useSuspendAdminUser();
  const removeSuspendMutation = useRemoveAdminUserSuspension();
  const archiveMutation = useArchiveAdminUser();

  const [editing, setEditing] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [removeSuspendOpen, setRemoveSuspendOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !userId) return null;

  const user = userQuery.data ?? null;
  const isSelf = Boolean(user && currentUserId && user.id === currentUserId);
  const isArchived = user?.status === 'ARCHIVED';
  const canRemoveSuspension = Boolean(user?.disciplinary.reason || user?.disciplinary.startAt || user?.disciplinary.endAt);

  function formatDate(value: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale);
  }

  const roleLabel = (role: string) => (role === 'admin' ? t('roleAdmin') : t('roleCoach'));
  const statusLabel = (status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE') =>
    status === 'DQ'
      ? t('details.statusDq')
      : status === 'ARCHIVED'
        ? t('details.statusArchived')
        : status === 'INACTIVE'
          ? t('details.statusInactive')
          : t('details.statusActive');

  async function handleUpdate(payload: {
    displayName: string;
    email: string;
    role: 'admin' | 'coach';
    clubId: string | null;
    isActive: boolean;
  }) {
    if (!user) return;

    try {
      await updateMutation.mutateAsync({ userId: user.id, ...payload });
      setEditing(false);
      setEditError(null);
      toast(t('details.updateSuccess'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_IN_USE') {
        setEditError(t('errorEmailInUse'));
        return;
      }
      setEditError(getCompactErrorMessage(error, tCommon('saveFailed')));
    }
  }

  async function handleSuspend(payload: {
    reason: string;
    startAt: string;
    endAt: string;
    note: string | null;
  }) {
    if (!user) return;
    try {
      await suspendMutation.mutateAsync({ userId: user.id, ...payload });
      setSuspendOpen(false);
      toast(t('details.suspendSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.suspendFailed')), 'error');
    }
  }

  async function handleRemoveSuspension() {
    if (!user) return;
    try {
      await removeSuspendMutation.mutateAsync(user.id);
      setRemoveSuspendOpen(false);
      toast(t('details.removeSuspendSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.removeSuspendFailed')), 'error');
    }
  }

  async function handleArchive() {
    if (!user) return;
    try {
      await archiveMutation.mutateAsync(user.id);
      setArchiveOpen(false);
      toast(t('details.archiveSuccess'));
    } catch (error) {
      toast(getCompactErrorMessage(error, t('details.archiveFailed')), 'error');
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed inset-0 z-[60] md:left-auto md:w-[min(480px,100vw)]">
        <div className="flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t('details.title')}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                {user?.displayName ?? tCommon('loading')}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-input)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {userQuery.isLoading && (
              <div className="space-y-3">
                <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-surface-alt)]" />
                <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
                <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
              </div>
            )}

            {userQuery.error && !user && (
              <InlineAlert variant="error">
                {tCommon('loadError')}
              </InlineAlert>
            )}

            {user && (
              <div className="space-y-5">
                <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-[var(--color-text)]">
                        {user.displayName}
                      </p>
                      <p className="text-[13px] text-[var(--color-text-muted)]">{user.email}</p>
                    </div>
                    <UserStatusBadge
                      status={user.status}
                      label={statusLabel(user.status)}
                    />
                  </div>
                  <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                    <UserDetailItem label={t('fieldRole')} value={roleLabel(user.role)} />
                    <UserDetailItem label={t('fieldClub')} value={user.club?.name ?? '—'} />
                    <UserDetailItem label={t('columns.createdAt')} value={formatDate(user.createdAt)} />
                    <UserDetailItem label={t('details.updatedAt')} value={formatDate(user.updatedAt)} />
                  </dl>
                </section>

                <section className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">
                    {t('details.accountState')}
                  </h3>
                  <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                    <UserDetailItem label={t('columns.status')} value={statusLabel(user.status)} />
                    <UserDetailItem label={t('details.activeToggle')} value={user.isActive ? t('details.yes') : t('details.no')} />
                    <UserDetailItem label={t('details.startAt')} value={formatDate(user.disciplinary.startAt)} />
                    <UserDetailItem label={t('details.endAt')} value={formatDate(user.disciplinary.endAt)} />
                    <UserDetailItem label={t('details.reason')} value={user.disciplinary.reason ?? '—'} />
                    <UserDetailItem label={t('details.note')} value={user.disciplinary.note ?? '—'} />
                    <UserDetailItem label={t('details.deletedAt')} value={formatDate(user.deletedAt)} />
                  </dl>
                </section>

                {editing && (
                  <UserEditForm
                    key={`${user.id}:${user.updatedAt}`}
                    user={user}
                    pending={updateMutation.isPending}
                    errorMessage={editError}
                    onCancel={() => {
                      setEditing(false);
                      setEditError(null);
                    }}
                    onSubmit={handleUpdate}
                  />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton disabled={!user || isArchived} onClick={() => setEditing((value) => !value)}>
                {editing ? t('details.closeEdit') : tCommon('edit')}
              </PrimaryButton>
              <SecondaryButton
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                disabled={!user || isArchived || isSelf}
                onClick={() => setSuspendOpen(true)}
              >
                {t('details.suspendAction')}
              </SecondaryButton>
              <SecondaryButton
                disabled={!user || isArchived || !canRemoveSuspension}
                onClick={() => setRemoveSuspendOpen(true)}
              >
                {t('details.removeSuspendAction')}
              </SecondaryButton>
              <SecondaryButton
                className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                disabled={!user || isArchived || isSelf}
                onClick={() => setArchiveOpen(true)}
              >
                {t('details.archiveAction')}
              </SecondaryButton>
            </div>

            {isSelf && (
              <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">
                {t('details.selfGuardHint')}
              </p>
            )}
          </div>
        </div>
      </div>

      <UserSuspendDialog
        open={suspendOpen}
        pending={suspendMutation.isPending}
        errorMessage={null}
        onClose={() => setSuspendOpen(false)}
        onConfirm={handleSuspend}
      />

      <UserActionDialog
        open={removeSuspendOpen}
        title={t('details.removeSuspendTitle')}
        description={t('details.removeSuspendDescription')}
        confirmLabel={t('details.removeSuspendAction')}
        pending={removeSuspendMutation.isPending}
        errorMessage={null}
        onClose={() => setRemoveSuspendOpen(false)}
        onConfirm={handleRemoveSuspension}
      />

      <UserActionDialog
        open={archiveOpen}
        title={t('details.archiveTitle')}
        description={t('details.archiveDescription')}
        confirmLabel={tCommon('delete')}
        pending={archiveMutation.isPending}
        errorMessage={null}
        tone="danger"
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
      />
    </>
  );
}
