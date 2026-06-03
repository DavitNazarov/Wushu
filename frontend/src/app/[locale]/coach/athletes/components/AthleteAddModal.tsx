'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { AthleteForm } from './AthleteForm';
import type { AthleteFormState } from '../athletes.types';

type Props = {
  open: boolean;
  onClose: () => void;
  form: AthleteFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteFormState>>;
  isGeorgian: boolean;
  docIdError: string | null;
  setDocIdError: (v: string | null) => void;
  formValid: boolean;
  saving: boolean;
  onSave: () => void;
};

export function AthleteAddModal({
  open,
  onClose,
  form,
  setForm,
  isGeorgian,
  docIdError,
  setDocIdError,
  formValid,
  saving,
  onSave,
}: Props) {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');

  return (
    <Modal open={open} onClose={onClose} title={t('addAthlete')}>
      <div className="space-y-5">
        <AthleteForm
          form={form}
          setForm={setForm}
          isGeorgian={isGeorgian}
          docIdError={docIdError}
          setDocIdError={setDocIdError}
        />
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
          <PrimaryButton onClick={onSave} disabled={!formValid || saving}>
            {saving ? tC('loading') : tC('save')}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
