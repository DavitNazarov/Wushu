'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Label } from '@/components/ui/primitives/label';
import { Input } from '@/components/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { CategoryPicker } from '@/components/registration/CategoryPicker';
import { localizedFullName } from '@/lib/bilingual';
import type { AthleteRow, RegistrationRow } from '@/types/api';
import { LABEL_CLASS } from '../registrations.utils';

type Props = {
  open: boolean;
  onClose: () => void;
  eventSlug: string;
  locale: string;
  athletes: AthleteRow[] | undefined;
  allRows: RegistrationRow[];
  selectedAthleteId: string;
  selectedAgeGroupId: string;
  eventWeightCategoryId: string;
  notes: string;
  selectedAthlete: AthleteRow | null;
  alreadyRegistered: boolean;
  saving: boolean;
  onAthleteChange: (id: string) => void;
  onAgeGroupChange: (id: string) => void;
  onWeightCategoryChange: (id: string) => void;
  onNotesChange: (v: string) => void;
  onSave: () => void;
};

export function AddRegistrationModal({
  open,
  onClose,
  eventSlug,
  locale,
  athletes,
  allRows,
  selectedAthleteId,
  selectedAgeGroupId,
  eventWeightCategoryId,
  notes,
  selectedAthlete,
  alreadyRegistered,
  saving,
  onAthleteChange,
  onAgeGroupChange,
  onWeightCategoryChange,
  onNotesChange,
  onSave,
}: Props) {
  const t = useTranslations('coach.registrations');
  const tC = useTranslations('common');

  return (
    <Modal open={open} onClose={onClose} title={t('addRegistration')}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className={LABEL_CLASS}>{t('pickAthlete')}</Label>
          <Select value={selectedAthleteId} onValueChange={onAthleteChange}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {athletes?.map((a) => {
                const reg = allRows.find((r) => r.athleteId === a.id && r.status !== 'WITHDRAWN');
                return (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span>
                        {localizedFullName(a.firstName, a.lastName, a.firstNameKa, a.lastNameKa, locale)}{a.dateOfBirth ? ` (${new Date(a.dateOfBirth).getFullYear()})` : ''}
                      </span>
                      {reg && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                          {reg.categoryCode}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {alreadyRegistered && (
          <div className="rounded-[var(--radius-input)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] px-3 py-2.5 text-[13px] text-[var(--color-warning)]">
            {selectedAthlete
              ? `${localizedFullName(selectedAthlete.firstName, selectedAthlete.lastName, selectedAthlete.firstNameKa, selectedAthlete.lastNameKa, locale)} is already registered for this event.`
              : 'This athlete is already registered for this event.'}
          </div>
        )}

        {!alreadyRegistered && (
          <>
            <div className="space-y-1.5">
              <Label className={LABEL_CLASS}>{t('pickCategory')}</Label>
              <CategoryPicker
                eventSlug={eventSlug}
                ageGroupId={selectedAgeGroupId}
                weightCategoryId={eventWeightCategoryId}
                onAgeGroupChange={onAgeGroupChange}
                onWeightCategoryChange={onWeightCategoryChange}
                disabled={saving}
                athlete={selectedAthlete}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL_CLASS}>{t('notesOptional')}</Label>
              <Input type="text" value={notes} onChange={(e) => onNotesChange(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
          <button
            onClick={onSave}
            disabled={!selectedAthleteId || !eventWeightCategoryId || alreadyRegistered || saving}
            className="h-9 rounded-[var(--radius-input)] bg-[var(--color-primary)] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {saving ? tC('loading') : tC('save')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
