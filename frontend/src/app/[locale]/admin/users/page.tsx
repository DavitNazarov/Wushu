'use client';

import { type ReactNode, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { UserDetailsDrawer } from '@/components/admin/users/UserDetailsDrawer';
import { apiGet } from '@/lib/api/client';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { CreateUserModal } from './CreateUserModal';

type AuthMe = {
  userId: string | null;
};

export default function UsersPage() {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const usersQuery = useAdminUsers();
  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => apiGet<AuthMe>('/api/auth/me'),
  });
  const list = usersQuery.data ?? [];

  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale);
  }

  function roleLabel(role: string) {
    return role === 'admin' ? t('roleAdmin') : t('roleCoach');
  }

  function statusLabel(status: 'ACTIVE' | 'DQ' | 'ARCHIVED' | 'INACTIVE') {
    if (status === 'DQ') return t('details.statusDq');
    if (status === 'ARCHIVED') return t('details.statusArchived');
    if (status === 'INACTIVE') return t('details.statusInactive');
    return t('details.statusActive');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={<PrimaryButton onClick={() => setCreateOpen(true)}>{t('new')}</PrimaryButton>}
      />

      {usersQuery.error && (
        <AdminErrorAlert
          error={usersQuery.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => usersQuery.refetch()}
        />
      )}

      {usersQuery.isLoading ? (
        <SkeletonRows rows={5} cols={6} />
      ) : list.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="bg-[var(--color-surface-alt)]">
                  <HeaderCell>{t('columns.displayName')}</HeaderCell>
                  <HeaderCell>{t('columns.email')}</HeaderCell>
                  <HeaderCell>{t('columns.role')}</HeaderCell>
                  <HeaderCell>{t('columns.club')}</HeaderCell>
                  <HeaderCell>{t('columns.status')}</HeaderCell>
                  <HeaderCell>{t('columns.createdAt')}</HeaderCell>
                  <HeaderCell />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {list.map((user) => (
                  <tr
                    key={user.id}
                    tabIndex={0}
                    className="cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    onClick={() => setSelectedUserId(user.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedUserId(user.id);
                      }
                    }}
                  >
                    <Cell strong>{user.displayName || '—'}</Cell>
                    <Cell>{user.email}</Cell>
                    <Cell>{roleLabel(user.role)}</Cell>
                    <Cell>{user.club?.name ?? '—'}</Cell>
                    <Cell>
                      <UserStatusBadge
                        status={user.status}
                        label={statusLabel(user.status)}
                      />
                    </Cell>
                    <Cell>{formatDate(user.createdAt)}</Cell>
                    <Cell align="right">
                      <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-text-muted)]" />
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 sm:hidden">
            {list.map((user) => (
              <button
                key={user.id}
                type="button"
                className="w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:bg-[var(--color-surface-alt)]"
                onClick={() => setSelectedUserId(user.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-text)]">
                      {user.displayName || '—'}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {user.email}
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                      {roleLabel(user.role)} · {user.club?.name ?? '—'}
                    </p>
                  </div>
                  <UserStatusBadge
                    status={user.status}
                    label={statusLabel(user.status)}
                  />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UserDetailsDrawer
        key={selectedUserId ?? 'none'}
        userId={selectedUserId}
        currentUserId={meQuery.data?.userId ?? null}
        open={selectedUserId !== null}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}

function HeaderCell({ children }: { children?: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}

function Cell({
  children,
  strong = false,
  align = 'left',
}: {
  children: ReactNode;
  strong?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <td
      className={`px-4 py-3 ${
        strong ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </td>
  );
}
