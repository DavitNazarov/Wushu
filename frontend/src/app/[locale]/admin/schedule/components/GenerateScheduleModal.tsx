'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SCHEDULE_INPUT_CLASS } from '../schedule.utils';
import type { GenerateFormState } from '../schedule.types';

type Props = {
  open: boolean;
  form: GenerateFormState;
  setForm: React.Dispatch<React.SetStateAction<GenerateFormState>>;
  running: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function GenerateScheduleModal({ open, form, setForm, running, onClose, onSubmit }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('generateSchedule')}
      description={t('generateScheduleDesc')}
      footer={
        <>
          <SecondaryButton onClick={onClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton disabled={running} onClick={onSubmit}>
            {running ? tCommon('loading') : t('generate')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('avgBoutSeconds')}</label>
          <input
            type="number"
            className={SCHEDULE_INPUT_CLASS}
            value={form.avgBoutSeconds}
            onChange={(e) => setForm((f) => ({ ...f, avgBoutSeconds: Number(e.target.value) }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-[var(--color-text-muted)]">{t('bufferSeconds')}</label>
          <input
            type="number"
            className={SCHEDULE_INPUT_CLASS}
            value={form.bufferSeconds}
            onChange={(e) => setForm((f) => ({ ...f, bufferSeconds: Number(e.target.value) }))}
          />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-[12px] text-[var(--color-text-muted)]">
          {t('gapRuleNote')}
        </div>
      </div>
    </Modal>
  );
}
