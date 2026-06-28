'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { EventDateField } from '@/features/events/components/EventDateField';
import { SCHEDULE_INPUT_CLASS, combineDateTime, splitDateTime } from '../schedule.utils';
import type { SessionFormState } from '../schedule.types';

type Props = {
  open: boolean;
  isEditing: boolean;
  form: SessionFormState;
  setForm: React.Dispatch<React.SetStateAction<SessionFormState>>;
  saving: boolean;
  /** Event fight days (`YYYY-MM-DD`); the date pickers only allow these. */
  fightDays: string[];
  onClose: () => void;
  onSubmit: () => void;
};

const LABEL_CLASS = 'mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]';

export function SessionFormModal({ open, isEditing, form, setForm, saving, fightDays, onClose, onSubmit }: Props) {
  const t = useTranslations('schedule');
  const tCommon = useTranslations('common');

  const start = splitDateTime(form.startTime);
  const end = splitDateTime(form.endTime);

  const setStart = (date: string, time: string) =>
    setForm((f) => ({ ...f, startTime: combineDateTime(date, time) }));
  const setEnd = (date: string, time: string) =>
    setForm((f) => ({ ...f, endTime: combineDateTime(date, time) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editSession') : t('addSession')}
      description={t('addSessionDesc')}
      widthClassName="max-w-lg"
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
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS}>{t('sessionName')}</label>
            <input
              className={SCHEDULE_INPUT_CLASS}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('sessionNamePlaceholder')}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t('sessionNameKa')}</label>
            <input
              className={SCHEDULE_INPUT_CLASS}
              value={form.nameKa}
              onChange={(e) => setForm((f) => ({ ...f, nameKa: e.target.value }))}
              placeholder={t('sessionNameKaPlaceholder')}
            />
          </div>
        </div>

        <div className="grid items-start gap-3 sm:grid-cols-2">
          <EventDateField
            label={t('sessionStart')}
            value={start.date}
            max={end.date || undefined}
            allowedDays={fightDays}
            popoverAlign="start"
            onChange={(date) => setStart(date, start.time)}
          />
          <div>
            <label className={LABEL_CLASS}>{t('sessionStartTime')}</label>
            <input
              type="time"
              className={SCHEDULE_INPUT_CLASS}
              value={start.time}
              onChange={(e) => setStart(start.date, e.target.value)}
            />
          </div>
        </div>

        <div className="grid items-start gap-3 sm:grid-cols-2">
          <EventDateField
            label={t('sessionEnd')}
            value={end.date}
            min={start.date || undefined}
            allowedDays={fightDays}
            popoverAlign="end"
            onChange={(date) => setEnd(date, end.time)}
          />
          <div>
            <label className={LABEL_CLASS}>{t('sessionEndTime')}</label>
            <input
              type="time"
              className={SCHEDULE_INPUT_CLASS}
              value={end.time}
              onChange={(e) => setEnd(end.date, e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
