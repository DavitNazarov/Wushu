'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategoryTemplateRow, CategoryTemplateStatus, CategoryTemplateType } from '@/types/api';
import { CategoryTemplateCreateModal } from './CategoryTemplateCreateModal';
import { CategoryTemplateDeleteDialog } from './CategoryTemplateDeleteDialog';
import { CategoryTemplateDetailsDrawer } from './CategoryTemplateDetailsDrawer';
import { CategoryTemplateEditModal } from './CategoryTemplateEditModal';
import { CategoryTemplateFilters } from './CategoryTemplateFilters';
import { CategoryTemplateTable } from './CategoryTemplateTable';

export default function CategoryTemplatesPage() {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<CategoryTemplateRow | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CategoryTemplateStatus | 'ALL'>('ALL');
  const [type, setType] = useState<CategoryTemplateType | 'ALL'>('ALL');

  const params = new URLSearchParams();
  if (search.trim()) params.set('q', search.trim());
  if (status !== 'ALL') params.set('status', status);
  if (type !== 'ALL') params.set('type', type);

  const query = useQuery({
    queryKey: ['category-templates', search, status, type],
    queryFn: () =>
      apiGet<CategoryTemplateRow[]>(
        `/api/category-templates${params.toString() ? `?${params.toString()}` : ''}`,
      ),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/category-templates/${id}/activate`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['category-templates'] });
      toast(t('actions.activateSuccess'));
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, t('actions.activateFailed')), 'error'),
  });

  const templates = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        actions={
          <PrimaryButton onClick={() => setCreateOpen(true)}>{t('new')}</PrimaryButton>
        }
      />

      <CategoryTemplateFilters
        search={search}
        status={status}
        type={type}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onTypeChange={setType}
        onReset={() => {
          setSearch('');
          setStatus('ALL');
          setType('ALL');
        }}
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
        <SkeletonRows rows={5} cols={7} />
      ) : templates.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={search || status !== 'ALL' || type !== 'ALL' ? t('emptyFilteredDescription') : t('emptyDescription')}
          action={
            <PrimaryButton onClick={() => setCreateOpen(true)}>{t('new')}</PrimaryButton>
          }
        />
      ) : (
        <CategoryTemplateTable
          templates={templates}
          onView={(template) => setSelectedTemplateId(template.id)}
          onEdit={(template) => setEditTemplateId(template.id)}
          onDelete={(template) => setDeleteTemplate(template)}
          onActivate={(template) => activateMutation.mutate(template.id)}
        />
      )}

      <CategoryTemplateCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <CategoryTemplateEditModal
        templateId={editTemplateId}
        open={Boolean(editTemplateId)}
        onClose={() => setEditTemplateId(null)}
      />
      <CategoryTemplateDeleteDialog
        template={deleteTemplate}
        open={Boolean(deleteTemplate)}
        onClose={() => setDeleteTemplate(null)}
      />
      <CategoryTemplateDetailsDrawer
        templateId={selectedTemplateId}
        open={Boolean(selectedTemplateId)}
        onClose={() => setSelectedTemplateId(null)}
        onEdit={(templateId) => setEditTemplateId(templateId)}
        onDelete={(template) => setDeleteTemplate(template)}
      />
    </div>
  );
}
