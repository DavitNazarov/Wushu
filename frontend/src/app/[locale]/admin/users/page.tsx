'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import type { UserRow } from '@/types/api';

type UserRole = 'coach' | 'athlete';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

export default function UsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('coach');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<UserRow[]>('/api/users'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<{ ok: boolean; id: string }>('/api/auth/signup', {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast(tCommon('saveSuccess'));
      setCreateOpen(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('coach');
      setError(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_ALREADY_IN_USE') {
          setError(t('errorEmailInUse'));
          return;
        }
        if (e.status === 403) {
          toast(t('errorForbidden'), 'error');
          return;
        }
      }
      toast(tCommon('saveFailed'), 'error');
    },
  });

  async function handleCreate() {
    setError(null);
    createMutation.mutate();
  }

  const isValid = email.trim().length > 0 && password.length >= 6 && displayName.trim().length > 0;
  const list = users ?? [];

  function formatDate(value: string) {
    try {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
    } catch {
      return '—';
    }
  }

  function roleLabel(r: string) {
    if (r === 'admin') return t('roleAdmin');
    if (r === 'coach') return t('roleCoach');
    if (r === 'athlete') return t('roleAthlete');
    return r;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <PrimaryButton onClick={() => setCreateOpen(true)}>
            {t('new')}
          </PrimaryButton>
        }
      />

      {loadError && (
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

      {isLoading ? (
        <SkeletonRows rows={5} cols={5} />
      ) : list.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    {t('columns.displayName')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    {t('columns.email')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    {t('columns.role')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    {t('columns.status')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
                    {t('columns.createdAt')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {list.map((u) => (
                  <tr key={u.id} className="bg-[var(--color-surface)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                      {u.displayName || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{u.email}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {roleLabel(u.role)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {u.isActive ? t('statusActive') : t('statusInactive')}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {list.map((u) => (
              <div
                key={u.id}
                className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <p className="font-medium text-[var(--color-text)]">{u.displayName || '—'}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{u.email}</p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {roleLabel(u.role)} · {u.isActive ? t('statusActive') : t('statusInactive')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('new')}
        description={t('createDescription')}
        footer={
          <>
            <SecondaryButton onClick={() => setCreateOpen(false)}>
              {tCommon('cancel')}
            </SecondaryButton>
            <PrimaryButton
              disabled={createMutation.isPending || !isValid}
              onClick={handleCreate}
            >
              {createMutation.isPending ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <InlineAlert variant="error">{error}</InlineAlert>
          )}
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fieldEmail')}
            </label>
            <input
              type="email"
              className={INPUT_CLASS}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="coach@club.ge"
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fieldPassword')}
            </label>
            <input
              type="password"
              className={INPUT_CLASS}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              {t('passwordHint')}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fieldDisplayName')}
            </label>
            <input
              type="text"
              className={INPUT_CLASS}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('displayNamePlaceholder')}
            />
          </div>
          <div>
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fieldRole')}
            </label>
            <select
              className={INPUT_CLASS}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="coach">{t('roleCoach')}</option>
              <option value="athlete">{t('roleAthlete')}</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
