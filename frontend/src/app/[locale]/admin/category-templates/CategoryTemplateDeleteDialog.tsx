'use client';

import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiDelete } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategoryTemplateRow } from '@/types/api';

type Props = {
  template: CategoryTemplateRow | null;
  open: boolean;
  onClose: () => void;
};

export function CategoryTemplateDeleteDialog({ template, open, onClose }: Props) {
  const t = useTranslations('admin.categoryTemplates');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiDelete(`/api/category-templates/${template?.id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['category-templates'] });
      toast(t('delete.success'));
      onClose();
    },
    onError: (error) =>
      toast(getCompactErrorMessage(error, t('delete.failed')), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('delete.title')}
      description={template?.name ?? ''}
      footer={
        <>
          <SecondaryButton disabled={mutation.isPending} onClick={onClose}>
            {tCommon('cancel')}
          </SecondaryButton>
          <PrimaryButton
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={mutation.isPending || !template?.canDelete}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tCommon('loading') : t('delete.confirm')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {t('delete.description')}
        </p>
        {template?.deleteBlockedReason && (
          <InlineAlert variant="warning">
            {t(`errors.${template.deleteBlockedReason}` as Parameters<typeof t>[0])}
          </InlineAlert>
        )}
      </div>
    </Modal>
  );
}
