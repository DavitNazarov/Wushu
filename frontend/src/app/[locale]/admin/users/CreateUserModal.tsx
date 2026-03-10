'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { ClubRow } from '@/types/api';
import { useCreateAdminUser } from '@/hooks/useAdminUserMutations';

type UserRole = 'admin' | 'coach';

const INPUT_CLASS =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

type CreateUserModalProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const t = useTranslations('admin.users');
  const tCommon = useTranslations('common');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('coach');
  const [clubId, setClubId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clubError, setClubError] = useState<string | null>(null);

  const {
    data: clubs,
    isLoading: clubsLoading,
    error: clubsError,
  } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
    enabled: open,
  });

  function resetForm() {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setRole('coach');
    setClubId('');
    setError(null);
    setClubError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const createMutation = useCreateAdminUser();

  function handleCreate() {
    setError(null);
    setClubError(null);

    if (role === 'coach' && !clubId) {
      setClubError(t('errorCoachClubRequired'));
      return;
    }

    createMutation.mutate(
      {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        clubId: role === 'coach' ? clubId || null : null,
      },
      {
        onSuccess: () => {
          toast(tCommon('saveSuccess'));
          handleClose();
        },
        onError: (e) => {
          if (e instanceof ApiError) {
            if (e.code === 'EMAIL_ALREADY_IN_USE') {
              setError(t('errorEmailInUse'));
              return;
            }
            if (e.code === 'COACH_CLUB_REQUIRED') {
              setClubError(t('errorCoachClubRequired'));
              return;
            }
            if (e.code === 'ADMIN_CLUB_FORBIDDEN') {
              setError(t('errorAdminClubForbidden'));
              return;
            }
            if (e.code === 'INVALID_CLUB') {
              setClubError(t('errorInvalidClub'));
              return;
            }
            if (e.status === 403) {
              toast(t('errorForbidden'), 'error');
              return;
            }
          }

          toast(getCompactErrorMessage(e, tCommon('saveFailed')), 'error');
        },
      },
    );
  }

  const showClubField = role === 'coach';
  const isValid =
    email.trim().length > 0 &&
    password.length >= 6 &&
    displayName.trim().length > 0 &&
    (!showClubField || clubId.length > 0);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('new')}
      description={t('createDescription')}
      footer={
        <>
          <SecondaryButton onClick={handleClose}>
            {tCommon('cancel')}
          </SecondaryButton>
          <PrimaryButton
            disabled={createMutation.isPending || !isValid}
            onClick={handleCreate}
          >
            {createMutation.isPending ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <InlineAlert variant="error">{error}</InlineAlert>}
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('fieldEmail')}
          </label>
          <input
            type="email"
            className={INPUT_CLASS}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="coach@club.ge"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('fieldPassword')}
          </label>
          <input
            type="password"
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {t('passwordHint')}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('fieldDisplayName')}
          </label>
          <input
            type="text"
            className={INPUT_CLASS}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('displayNamePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
            {t('fieldRole')}
          </label>
          <select
            className={INPUT_CLASS}
            value={role}
            onChange={(e) => {
              const nextRole = e.target.value as UserRole;
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
            {clubsError && (
              <InlineAlert variant="error">{tCommon('loadError')}</InlineAlert>
            )}
            <label className="mb-1 block text-[13px] font-medium text-[var(--color-text)]">
              {t('fieldClub')}
            </label>
            <select
              className={INPUT_CLASS}
              value={clubId}
              disabled={clubsLoading}
              onChange={(e) => {
                setClubId(e.target.value);
                setClubError(null);
              }}
            >
              <option value="">
                {clubsLoading ? t('loadingClubs') : t('selectClubPlaceholder')}
              </option>
              {(clubs ?? []).map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            {clubError && (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">
                {clubError}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
