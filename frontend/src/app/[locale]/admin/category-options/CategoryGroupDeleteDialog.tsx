'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { apiDelete } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { localizedName } from '@/lib/bilingual';
import type { CategoryOptionGroupRow } from '@/types/api';

type Props = {
  group: CategoryOptionGroupRow | null;
  open: boolean;
  onClose: () => void;
};

export function CategoryGroupDeleteDialog({ group, open, onClose }: Props) {
  const locale = useLocale();
  const t = useTranslations('admin.categoryOptions');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => apiDelete(`/api/category-option-groups/${group?.id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['category-option-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['category-options'] }),
      ]);
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
      description={group ? localizedName(group.name, group.nameKa, locale) : ''}
      footer={
        <>
          <SecondaryButton disabled={mutation.isPending} onClick={onClose}>
            {tCommon('cancel')}
          </SecondaryButton>
          <PrimaryButton
            className="bg-red-600 text-white hover:bg-red-700"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tCommon('loading') : t('delete.confirm')}
          </PrimaryButton>
        </>
      }
    >
      <p className="text-[13px] text-[var(--color-text-muted)]">
        {t('delete.description')}
      </p>
    </Modal>
  );
}
