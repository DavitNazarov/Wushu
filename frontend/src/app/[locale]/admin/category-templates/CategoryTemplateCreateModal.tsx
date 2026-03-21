'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategoryOptionGroupRow, CategoryTemplateRow, CategoryTemplateStatus } from '@/types/api';
import { CategoryTemplateBuilder } from './CategoryTemplateBuilder';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CategoryTemplateCreateModal({ open, onClose }: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<CategoryTemplateStatus>('ACTIVE');
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  const { data, error, refetch } = useQuery({
    queryKey: ['category-options'],
    queryFn: () => apiGet<CategoryOptionGroupRow[]>('/api/category-options'),
    enabled: open,
  });

  function handleClose() {
    setName('');
    setStatus('ACTIVE');
    setSelectedOptionIds([]);
    onClose();
  }

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<CategoryTemplateRow>('/api/category-templates', {
        name: name.trim(),
        status,
        categoryOptionIds: selectedOptionIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-templates'] });
      toast(tCommon('saveSuccess'));
      handleClose();
    },
    onError: (mutationError) =>
      toast(getCompactErrorMessage(mutationError, tCommon('saveFailed')), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('new')}
      description={t('createDescription')}
      footer={
        <>
          <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            disabled={createMutation.isPending || !name.trim() || selectedOptionIds.length === 0}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? tCommon('loading') : tCommon('create')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <AdminErrorAlert
            error={error}
            fallbackMessage={t('builder.loadError')}
            retryLabel={tCommon('retry')}
            onRetry={() => refetch()}
          />
        )}

        <CategoryTemplateBuilder
          name={name}
          status={status}
          selectedOptionIds={selectedOptionIds}
          optionGroups={data ?? []}
          onNameChange={setName}
          onStatusChange={setStatus}
          onSelectedOptionIdsChange={setSelectedOptionIds}
        />
      </div>
    </Modal>
  );
}
