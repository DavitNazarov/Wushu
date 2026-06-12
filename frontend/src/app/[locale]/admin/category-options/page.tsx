'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { apiGet } from '@/lib/api/client';
import type { CategoryOptionGroupRow } from '@/types/api';
import { CategoryGroupCard } from './CategoryGroupCard';
import { CategoryGroupDeleteDialog } from './CategoryGroupDeleteDialog';
import { CategoryGroupFormModal } from './CategoryGroupFormModal';

export default function CategoryOptionsPage() {
  const t = useTranslations('admin.categoryOptions');
  const tCommon = useTranslations('common');
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<CategoryOptionGroupRow | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<CategoryOptionGroupRow | null>(null);

  const query = useQuery({
    queryKey: ['category-option-groups'],
    queryFn: () =>
      apiGet<CategoryOptionGroupRow[]>('/api/category-option-groups'),
  });

  const groups = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <PrimaryButton onClick={() => setCreateOpen(true)}>{t('new')}</PrimaryButton>
        }
      />

      {query.error && (
        <AdminErrorAlert
          error={query.error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => query.refetch()}
        />
      )}

      {query.isLoading ? (
        <SkeletonRows rows={4} cols={3} />
      ) : groups.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <PrimaryButton onClick={() => setCreateOpen(true)}>{t('new')}</PrimaryButton>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <CategoryGroupCard
              key={group.id}
              group={group}
              onEdit={() => setEditGroup(group)}
              onDelete={() => setDeleteGroup(group)}
            />
          ))}
        </div>
      )}

      <CategoryGroupFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <CategoryGroupFormModal
        mode="edit"
        group={editGroup}
        open={Boolean(editGroup)}
        onClose={() => setEditGroup(null)}
      />
      <CategoryGroupDeleteDialog
        group={deleteGroup}
        open={Boolean(deleteGroup)}
        onClose={() => setDeleteGroup(null)}
      />
    </div>
  );
}
