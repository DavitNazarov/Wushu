'use client';

import { useTranslations } from 'next-intl';
import { Check, CheckCircle2, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
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
  success: { name: string; allRegistered: boolean } | null;
  onAddAnother: () => void;
  noAthletesAvailable: boolean;
  hasAnyAthletes: boolean;
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
  success,
  onAddAnother,
  noAthletesAvailable,
  hasAnyAthletes,
}: Props) {
  const t = useTranslations('coach.registrations');
  const tC = useTranslations('common');

  // Success screen — shown after an athlete is registered. Mirrors the admin
  // "Add athlete to event" success step, minus the multi-club actions a coach
  // (single club) doesn't have.
  if (success) {
    return (
      <Modal open={open} onClose={onClose} title={t('addRegistration')}>
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)]">
            <Check className="h-7 w-7" strokeWidth={2.5} />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text)]">
            {t('successTitle')}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--color-text-muted)]">
            {t('successBody', { name: success.name })}
          </p>
          {success.allRegistered && (
            <p className="mt-2 max-w-sm text-[13px] font-medium text-[var(--color-success)]">
              {t('successAllRegistered')}
            </p>
          )}
          <div className="mt-6 flex w-full flex-col gap-2">
            {success.allRegistered ? (
              <PrimaryButton className="w-full" onClick={onClose}>
                {tC('close')}
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton className="w-full" onClick={onAddAnother}>
                  {t('addAnotherAthlete')}
                </PrimaryButton>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  {t('done')}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // Nothing left to register — every athlete is already entered, or the coach
  // has no athletes yet. Informational state with only a Close action.
  if (noAthletesAvailable) {
    return (
      <Modal open={open} onClose={onClose} title={t('addRegistration')}>
        <div className="flex flex-col items-center px-2 py-4 text-center">
          {hasAnyAthletes ? (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-subtle)] text-[var(--color-success)]">
              <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
              <Users className="h-7 w-7" strokeWidth={2} />
            </div>
          )}
          <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text)]">
            {hasAnyAthletes ? t('allRegisteredTitle') : t('noAthletesTitle')}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--color-text-muted)]">
            {hasAnyAthletes ? t('allRegisteredBody') : t('noAthletesBody')}
          </p>
          <div className="mt-6 w-full">
            <PrimaryButton className="w-full" onClick={onClose}>
              {tC('close')}
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    );
  }

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
