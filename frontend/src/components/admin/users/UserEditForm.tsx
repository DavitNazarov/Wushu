'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { localizedName } from '@/lib/bilingual';
import { useQuery } from '@tanstack/react-query';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { apiGet } from '@/lib/api/client';
import type { ClubRow, UserDetailRow } from '@/types/api';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type Props = {
  user: UserDetailRow;
  pending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (payload: {
    displayName: string;
    email: string;
    role: 'admin' | 'coach';
    clubId: string | null;
    nationality: string | null;
    isActive: boolean;
  }) => void;
};

export function UserEditForm({
  user,
  pending,
  errorMessage,
  onCancel,
  onSubmit,
}: Props) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<'admin' | 'coach'>(user.role);
  const [clubId, setClubId] = useState(user.clubId ?? '');
  const [nationality, setNationality] = useState<'GE' | 'INTL'>(
    user.nationality === 'GE' ? 'GE' : 'INTL',
  );
  const [isActive, setIsActive] = useState(user.isActive);
  const [clubError, setClubError] = useState<string | null>(null);

  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
    enabled: role === 'coach',
  });

  const showClubField = role === 'coach';

  // City + country are derived from the selected club (server-side); show
  // them read-only so the admin sees where this coach lands in the hierarchy.
  const selectedClub = (clubs ?? []).find((c) => c.id === clubId) ?? null;
  const clubRegionLabel = selectedClub
    ? [
        selectedClub.cityName
          ? localizedName(selectedClub.cityName, selectedClub.cityNameKa, locale)
          : null,
        selectedClub.country,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  function handleSubmit() {
    setClubError(null);
    if (showClubField && !clubId) {
      setClubError(t('errorCoachClubRequired'));
      return;
    }

    onSubmit({
      displayName: displayName.trim(),
      email: email.trim(),
      role,
      clubId: showClubField ? clubId : null,
      nationality: showClubField ? (nationality === 'GE' ? 'GE' : null) : null,
      isActive,
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          {t('details.editTitle')}
        </h3>
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          {t('details.activeToggle')}
        </label>
      </div>

      {errorMessage && <InlineAlert variant="error">{errorMessage}</InlineAlert>}

      <div>
        <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
          {t('fieldDisplayName')}
        </label>
        <input
          className={INPUT_CLASS}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
          {t('fieldEmail')}
        </label>
        <input
          className={INPUT_CLASS}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
          {t('fieldRole')}
        </label>
        <select
          className={INPUT_CLASS}
          value={role}
          onChange={(event) => {
            const nextRole = event.target.value as 'admin' | 'coach';
            setRole(nextRole);
            if (nextRole !== 'coach') {
              setClubId('');
              setClubError(null);
            }
          }}
        >
          <option value="admin">{t('roleAdmin')}</option>
          <option value="coach">{t('roleCoach')}</option>
        </select>
      </div>

      {showClubField && (
        <div>
          <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
            {t('fieldClub')}
          </label>
          <select
            className={INPUT_CLASS}
            value={clubId}
            disabled={clubsLoading}
            onChange={(event) => {
              setClubId(event.target.value);
              setClubError(null);
            }}
          >
            <option value="">
              {clubsLoading ? t('loadingClubs') : t('selectClubPlaceholder')}
            </option>
            {(clubs ?? []).map((club) => (
              <option key={club.id} value={club.id}>
                {localizedName(club.name, club.nameKa, locale)}
              </option>
            ))}
          </select>
          {clubError && (
            <p className="mt-1 text-[12px] text-[var(--color-danger)]">{clubError}</p>
          )}
          {clubRegionLabel && (
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              {t('coachRegionHint', { location: clubRegionLabel })}
            </p>
          )}
        </div>
      )}

      {showClubField && (
        <div>
          <label className="mb-1 block text-[12px] text-[var(--color-text-muted)]">
            {t('fieldNationality')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['GE', 'INTL'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setNationality(opt)}
                className={`h-10 rounded-[var(--radius-input)] border px-3 text-[13px] font-medium transition ${
                  nationality === opt
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                {opt === 'GE' ? t('nationalityGeorgian') : t('nationalityInternational')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onCancel}>{tCommon('cancel')}</SecondaryButton>
        <PrimaryButton disabled={pending} onClick={handleSubmit}>
          {pending ? tCommon('loading') : tCommon('save')}
        </PrimaryButton>
      </div>
    </div>
  );
}
