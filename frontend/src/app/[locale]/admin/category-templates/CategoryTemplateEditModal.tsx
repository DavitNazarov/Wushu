'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPatch } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type {
  CategoryOptionGroupRow,
  CategoryTemplateDetailRow,
  CategoryTemplateRow,
  CategoryTemplateStatus,
} from '@/types/api';
import { CategoryTemplateBuilder } from './CategoryTemplateBuilder';

type Props = {
  templateId: string | null;
  open: boolean;
  onClose: () => void;
};

export function CategoryTemplateEditModal({ templateId, open, onClose }: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const detailQuery = useQuery({
    queryKey: ['category-template', templateId],
    queryFn: () => apiGet<CategoryTemplateDetailRow>(`/api/category-templates/${templateId}`),
    enabled: open && Boolean(templateId),
  });

  const optionsQuery = useQuery({
    queryKey: ['category-options'],
    queryFn: () => apiGet<CategoryOptionGroupRow[]>('/api/category-options'),
    enabled: open && Boolean(templateId),
  });

  const template = detailQuery.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('edit.title')}
      description={template?.name ?? t('edit.description')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <span />
        </>
      }
    >
      <div className="space-y-4">
        {(detailQuery.error || optionsQuery.error) && (
          <AdminErrorAlert
            error={detailQuery.error ?? optionsQuery.error}
            fallbackMessage={tCommon('loadError')}
            retryLabel={tCommon('retry')}
            onRetry={() => {
              void detailQuery.refetch();
              void optionsQuery.refetch();
            }}
          />
        )}

        {template && !template.permissions.canEdit && (
          <InlineAlert variant="warning">{t('errors.systemProtected')}</InlineAlert>
        )}

        {template && !template.permissions.canEditStructure && (
          <InlineAlert variant="warning">{t('edit.structureLocked')}</InlineAlert>
        )}

        {template && (
          <EditTemplateForm
            key={`${template.id}:${template.updatedAt}`}
            template={template}
            optionGroups={optionsQuery.data ?? []}
            templateId={templateId}
            onClose={onClose}
            onSaved={async () => {
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['category-templates'] }),
                queryClient.invalidateQueries({ queryKey: ['category-template', templateId] }),
              ]);
              toast(tCommon('saveSuccess'));
            }}
          />
        )}
      </div>
    </Modal>
  );
}

function EditTemplateForm({
  template,
  optionGroups,
  templateId,
  onClose,
  onSaved,
}: {
  template: CategoryTemplateDetailRow;
  optionGroups: CategoryOptionGroupRow[];
  templateId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const { toast } = useToast();
  const [name, setName] = useState(template.name);
  const [status, setStatus] = useState<CategoryTemplateStatus>(template.status);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(
    template.selectedCategoryOptionIds,
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiPatch<CategoryTemplateRow>(`/api/category-templates/${templateId}`, {
        name: name.trim(),
        status,
        ...(template.permissions.canEditStructure
          ? { categoryOptionIds: selectedOptionIds }
          : {}),
      }),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error'),
  });

  return (
    <>
      <CategoryTemplateBuilder
        name={name}
        status={status}
        selectedOptionIds={selectedOptionIds}
        optionGroups={optionGroups}
        disableStatus={!template.permissions.canEdit}
        onNameChange={setName}
        onStatusChange={setStatus}
        onSelectedOptionIdsChange={setSelectedOptionIds}
      />
      <div className="flex justify-end">
        <PrimaryButton
          disabled={
            mutation.isPending ||
            !template.permissions.canEdit ||
            !name.trim() ||
            selectedOptionIds.length === 0
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? tCommon('loading') : tCommon('save')}
        </PrimaryButton>
      </div>
      {!template.permissions.canEdit && (
        <p className="text-[12px] text-[var(--color-text-muted)]">{t('errors.systemProtected')}</p>
      )}
    </>
  );
}
