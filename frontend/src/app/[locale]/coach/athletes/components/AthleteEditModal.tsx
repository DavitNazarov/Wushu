'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, CalendarDays, FileBadge2, UserRound } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { localizedFullName } from '@/lib/bilingual';
import type { AthleteRow } from '@/types/api';
import { AthleteForm } from './AthleteForm';
import { formatDob, getInitials } from '../athletes.utils';
import type { AthleteFormState } from '../athletes.types';

type Props = {
  athlete: AthleteRow | null;
  onClose: () => void;
  form: AthleteFormState;
  setForm: React.Dispatch<React.SetStateAction<AthleteFormState>>;
  isGeorgian: boolean;
  docIdError: string | null;
  setDocIdError: (v: string | null) => void;
  formValid: boolean;
  saving: boolean;
  onSave: () => void;
  locale: string;
};

export function AthleteEditModal({
  athlete,
  onClose,
  form,
  setForm,
  isGeorgian,
  docIdError,
  setDocIdError,
  formValid,
  saving,
  onSave,
  locale,
}: Props) {
  const t = useTranslations('coach.athletes');
  const tC = useTranslations('common');
  const tProfile = useTranslations('athleteProfile.identity');

  return (
    <Modal
      open={!!athlete}
      onClose={onClose}
      title={athlete ? localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale) : ''}
    >
      <div className="space-y-5">
        {athlete && (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]/50 p-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-primary)] text-[15px] font-semibold uppercase tracking-[0.08em] text-white">
              {getInitials(athlete)}
            </div>
            <div className="min-w-0 flex-1 text-[12px] text-[var(--color-text-muted)]">
              <div className="flex flex-wrap gap-3">
                {athlete.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDob(athlete.dateOfBirth, locale)}
                  </span>
                )}
                {athlete.sex && (
                  <span className="flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {tProfile(`sexValue.${athlete.sex}`)}
                  </span>
                )}
                {athlete.documentId && (
                  <span className="flex items-center gap-1">
                    <FileBadge2 className="h-3.5 w-3.5" />
                    {athlete.documentId}
                  </span>
                )}
                {athlete.club && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {athlete.club.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <AthleteForm
          form={form}
          setForm={setForm}
          isGeorgian={isGeorgian}
          docIdError={docIdError}
          setDocIdError={setDocIdError}
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          {athlete && (
            <Link
              href={`/${locale}/coach/athletes/${athlete.id}`}
              onClick={onClose}
              className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
            >
              {t('viewProfile')} →
            </Link>
          )}
          <div className="flex gap-2 ml-auto">
            <SecondaryButton onClick={onClose}>{tC('cancel')}</SecondaryButton>
            <PrimaryButton onClick={onSave} disabled={!formValid || saving}>
              {saving ? tC('loading') : tC('save')}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
