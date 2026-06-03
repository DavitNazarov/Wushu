'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SCHEDULE_INPUT_CLASS } from '../schedule.utils';
import type { SessionFormState } from '../schedule.types';

type Props = {
  open: boolean;
  isEditing: boolean;
  form: SessionFormState;
  setForm: React.Dispatch<React.SetStateAction<SessionFormState>>;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function SessionFormModal({ open, isEditing, form, setForm, saving, onClose, onSubmit }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editSession') : t('addSession')}
      description={t('addSessionDesc')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            disabled={!form.name.trim() || !form.startTime || !form.endTime || saving}
            onClick={onSubmit}
          >
            {saving ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionName')}</label>
          <input
            className={SCHEDULE_INPUT_CLASS}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t('sessionNamePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionStart')}</label>
          <input
            type="datetime-local"
            className={SCHEDULE_INPUT_CLASS}
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('sessionEnd')}</label>
          <input
            type="datetime-local"
            className={SCHEDULE_INPUT_CLASS}
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
