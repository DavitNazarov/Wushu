'use client';

import { type ReactNode, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { UserStatusBadge } from '@/components/admin/users/UserStatusBadge';
import { UserDetailsDrawer } from '@/components/admin/users/UserDetailsDrawer';
import { UserFilters } from '@/components/admin/users/UserFilters';
import { Pagination, PaginationInfo } from '@/components/ui/pagination/Pagination';
import { TableSection } from '@/components/ui/tables/TableSection';
import { apiGet } from '@/lib/api/client';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useUserFilters } from '@/hooks/useUserFilters';
import { usePagination } from '@/hooks/usePagination';
import { adminVariants } from '@/lib/animations/variants';
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

  // Filter and search
  const { filters, filteredItems, setSearch, setRole, setStatus, clearFilters } = useUserFilters(list, {
    searchFields: ['displayName', 'email'],
  });

  // Split filtered users by role
  const adminUsers = filteredItems.filter((u) => u.role === 'admin');
  const coachUsers = filteredItems.filter((u) => u.role === 'coach');

  // Pagination for each section
  const adminPagination = usePagination(adminUsers, { itemsPerPage: 10, initialPage: 1 });
  const coachPagination = usePagination(coachUsers, { itemsPerPage: 10, initialPage: 1 });

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
        <motion.div
          className="space-y-6"
          initial="initial"
          animate="animate"
          variants={adminVariants.staggerContainer}
        >
          {/* Filters */}
          <UserFilters
            search={filters.search}
            role={filters.role}
            status={filters.status}
            onSearchChange={setSearch}
            onRoleChange={setRole}
            onStatusChange={setStatus}
            onClear={clearFilters}
          />

          {filteredItems.length === 0 ? (
            <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
          ) : (
            <>
              {/* Admin Users Section */}
              <UserTableSection
                title={t('tableAdmins')}
                count={adminUsers.length}
                users={adminPagination.paginatedItems}
                totalUsers={adminUsers.length}
                onSelectUser={setSelectedUserId}
                formatDate={formatDate}
                statusLabel={statusLabel}
              />
              {adminUsers.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <PaginationInfo
                    currentPage={adminPagination.currentPage}
                    totalPages={adminPagination.totalPages}
                  />
                  <Pagination
                    currentPage={adminPagination.currentPage}
                    totalPages={adminPagination.totalPages}
                    onPageChange={adminPagination.goToPage}
                  />
                </div>
              )}

              {/* Coach Users Section */}
              {coachUsers.length > 0 && (
                <>
                  <UserTableSection
                    title={t('tableCoaches')}
                    count={coachUsers.length}
                    users={coachPagination.paginatedItems}
                    totalUsers={coachUsers.length}
                    onSelectUser={setSelectedUserId}
                    formatDate={formatDate}
                    statusLabel={statusLabel}
                  />
                  <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <PaginationInfo
                      currentPage={coachPagination.currentPage}
                      totalPages={coachPagination.totalPages}
                    />
                    <Pagination
                      currentPage={coachPagination.currentPage}
                      totalPages={coachPagination.totalPages}
                      onPageChange={coachPagination.goToPage}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
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

interface UserTableSectionProps {
  title: string;
  count: number;
  users: any[];
  totalUsers: number;
  onSelectUser: (id: string) => void;
  formatDate: (date: string) => string;
  statusLabel: (status: string) => string;
}

function UserTableSection({
  title,
  count,
  users,
  totalUsers,
  onSelectUser,
  formatDate,
  statusLabel,
}: UserTableSectionProps) {
  const t = useTranslations('admin.users');

  if (totalUsers === 0) return null;

  return (
    <motion.div
      className="space-y-3"
      variants={adminVariants.staggerChild}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">
          {title}
          <span className="ml-2 inline-block rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-muted)]">
            ({count})
          </span>
        </h2>
      </div>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
        <table className="min-w-full text-[13px]">
          <thead>
            <tr className="bg-[var(--color-surface-alt)]">
              <HeaderCell>{t('columns.displayName')}</HeaderCell>
              <HeaderCell>{t('columns.email')}</HeaderCell>
              <HeaderCell>{t('columns.club')}</HeaderCell>
              <HeaderCell>{t('columns.status')}</HeaderCell>
              <HeaderCell>{t('columns.createdAt')}</HeaderCell>
              <HeaderCell />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {users.map((user) => (
              <motion.tr
                key={user.id}
                tabIndex={0}
                className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                onClick={() => onSelectUser(user.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectUser(user.id);
                  }
                }}
                variants={adminVariants.staggerChild}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[11px] font-bold uppercase text-[var(--color-primary)] transition-transform duration-200 group-hover:scale-110">
                      {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-[var(--color-text)]">{user.displayName || '—'}</span>
                  </div>
                </td>
                <Cell>{user.email}</Cell>
                <Cell>{user.club?.name ?? '—'}</Cell>
                <Cell>
                  <UserStatusBadge
                    status={user.status}
                    label={statusLabel(user.status)}
                  />
                </Cell>
                <Cell>{formatDate(user.createdAt)}</Cell>
                <Cell align="right">
                  <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
                </Cell>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-2 sm:hidden">
        {users.map((user) => (
          <motion.button
            key={user.id}
            type="button"
            className="group w-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
            onClick={() => onSelectUser(user.id)}
            variants={adminVariants.staggerChild}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[12px] font-bold uppercase text-[var(--color-primary)]">
                  {(user.displayName || user.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text)]">
                    {user.displayName || '—'}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {user.email}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {user.club?.name ?? '—'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <UserStatusBadge
                  status={user.status}
                  label={statusLabel(user.status)}
                />
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
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
