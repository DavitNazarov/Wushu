'use client';

import { useTranslations } from 'next-intl';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

type Props = {
  canSubmit: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

export function EventFormActions({
  canSubmit,
  isPending,
  onCancel,
  onSubmit,
}: Props) {
  const tCommon = useTranslations('common');

  return (
    <>
      <SecondaryButton onClick={onCancel}>
        {tCommon('cancel')}
      </SecondaryButton>
      <PrimaryButton disabled={isPending || !canSubmit} onClick={onSubmit}>
        {isPending ? tCommon('loading') : tCommon('save')}
      </PrimaryButton>
    </>
  );
}
