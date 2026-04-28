'use client';

import { notFound, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Pencil } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '@/lib/api/client';
import { localizedName, localizedFullName } from '@/lib/bilingual';
import type { AthleteProfileResponse, ClubRow } from '@/types/api';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { useToast } from '@/components/ui/Toast';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import { AthleteProfileActions } from './AthleteProfileActions';
import { AthleteProfileCompetition } from './AthleteProfileCompetition';
import { AthleteProfileIdentity } from './AthleteProfileIdentity';
import { AthleteProfileOverview } from './AthleteProfileOverview';
import { AthleteProfileRegistrations } from './AthleteProfileRegistrations';

type Props = {
  athleteId: string;
  scope: 'admin' | 'coach' | 'public';
};

const EMPTY_SEX = '__none__';

function endpointForScope(scope: Props['scope'], athleteId: string): string {
  return scope === 'public' ? `/api/public/athletes/${athleteId}` : `/api/athletes/${athleteId}`;
}

function backHref(scope: Props['scope'], locale: string): string {
  if (scope === 'admin') return `/${locale}/admin/athletes`;
  if (scope === 'coach') return `/${locale}/coach/athletes`;
  return `/${locale}/events`;
}

function BackLabel({ scope }: { scope: Props['scope'] }) {
  const t = useTranslations('athleteProfile');
  return <>{t(`backLabel.${scope}`)}</>;
}

function isGeorgianClub(country: string | null | undefined): boolean {
  const c = (country ?? '').trim().toLowerCase();
  return c === 'ge' || c === 'georgia';
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-52 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div className="space-y-4">
          <div className="h-36 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="h-48 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
        </div>
        <div className="space-y-4">
          <div className="h-56 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
          <div className="h-32 rounded-[var(--radius-card)] bg-[var(--color-surface-alt)]" />
        </div>
      </div>
    </div>
  );
}

export function AthleteProfilePage({ athleteId, scope }: Props) {
  const t = useTranslations('athleteProfile');
  const tAthletes = useTranslations('athletes');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameKa, setFirstNameKa] = useState('');
  const [lastNameKa, setLastNameKa] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | ''>('');
  const [clubId, setClubId] = useState('');
  const [docIdError, setDocIdError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['athlete-profile', scope, athleteId],
    queryFn: () => apiGet<AthleteProfileResponse>(endpointForScope(scope, athleteId)),
    enabled: Boolean(athleteId),
  });

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
    enabled: editOpen && scope === 'admin',
  });

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<{ athlete: { id: string } }>('/api/athletes', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-profile', scope, athleteId] });
      toast(tCommon('saveSuccess'));
      setEditOpen(false);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.code === 'DOCUMENT_ID_ALREADY_EXISTS') {
        setDocIdError(tAthletes('errors.documentIdExists'));
        return;
      }
      toast(e instanceof Error ? e.message : tCommon('saveFailed'), 'error');
    },
  });

  if (query.error instanceof ApiError && query.error.status === 404) {
    notFound();
  }

  function openEdit() {
    const athlete = query.data?.athlete;
    if (!athlete) return;
    setFirstName(athlete.firstName);
    setLastName(athlete.lastName);
    setFirstNameKa(athlete.firstNameKa ?? '');
    setLastNameKa(athlete.lastNameKa ?? '');
    setDateOfBirth(toDateInput(athlete.dateOfBirth));
    setDocumentId(athlete.documentId ?? '');
    setSex(athlete.sex ?? '');
    setClubId(athlete.club?.id ?? '');
    setDocIdError(null);
    setEditOpen(true);
  }

  function handleSave() {
    setDocIdError(null);
    if (!firstName.trim() || !lastName.trim() || !dateOfBirth) return;
    if (!documentId.trim()) {
      setDocIdError(tAthletes('errors.documentIdRequired'));
      return;
    }

    const effectiveClubId =
      scope === 'admin' ? clubId : (query.data?.athlete.club?.id ?? '');

    const body: Record<string, unknown> = {
      id: athleteId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      // Preserve KA names regardless of club nationality — switching clubs
      // shouldn't destroy a previously-recorded Georgian spelling.
      firstNameKa: firstNameKa.trim() || null,
      lastNameKa: lastNameKa.trim() || null,
      dateOfBirth,
      documentId: documentId.trim(),
      sex: sex || undefined,
    };
    if (scope === 'admin' && effectiveClubId) {
      body.clubId = effectiveClubId;
    }

    saveMutation.mutate(body);
  }

  const athlete = query.data?.athlete;
  const effectiveClubForEdit = scope === 'admin'
    ? (clubs ?? []).find((c) => c.id === clubId) ?? athlete?.club
    : athlete?.club;
  const showKaFields = isGeorgianClub(effectiveClubForEdit?.country);

  const formValid = !!firstName.trim() && !!lastName.trim() && !!dateOfBirth && !!documentId.trim();

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          <BackLabel scope={scope} />
        </button>

        {scope !== 'public' && athlete && (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {tCommon('edit')}
          </button>
        )}
      </motion.div>

      {query.error && !(query.error instanceof ApiError && query.error.status === 404) && (
        <InlineAlert
          variant="error"
          actions={
            <button type="button" onClick={() => query.refetch()} className="text-[13px] font-medium underline">
              {tCommon('retry')}
            </button>
          }
        >
          {tCommon('loadError')}
        </InlineAlert>
      )}

      {query.isLoading ? (
        <ProfileSkeleton />
      ) : query.data ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AthleteProfileOverview
            athlete={query.data.athlete}
            registrations={query.data.registrations}
            fights={query.data.fights}
            scope={scope}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="space-y-5">
              <AthleteProfileRegistrations registrations={query.data.registrations} scope={scope} />
              <AthleteProfileCompetition athleteId={query.data.athlete.id} fights={query.data.fights} scope={scope} />
            </div>
            <div className="space-y-5">
              <AthleteProfileIdentity athlete={query.data.athlete} scope={scope} />
              {scope !== 'public' && <AthleteProfileActions scope={scope} registrations={query.data.registrations} />}
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={athlete ? localizedFullName(athlete.firstName, athlete.lastName, athlete.firstNameKa, athlete.lastNameKa, locale) : ''}
        footer={
          <>
            <SecondaryButton onClick={() => setEditOpen(false)}>{tCommon('cancel')}</SecondaryButton>
            <PrimaryButton disabled={!formValid || saveMutation.isPending} onClick={handleSave}>
              {saveMutation.isPending ? tCommon('loading') : tCommon('save')}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          {/* English name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{showKaFields ? tAthletes('fields.firstNameEn') : tAthletes('fields.firstName')} *</Label>
              <Input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
            </div>
            <div className="space-y-1.5">
              <Label>{showKaFields ? tAthletes('fields.lastNameEn') : tAthletes('fields.lastName')} *</Label>
              <Input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
            </div>
          </div>

          {/* Georgian name row — shown when club is Georgian */}
          {showKaFields && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{tAthletes('fields.firstNameKa')}</Label>
                <Input type="text" value={firstNameKa} onChange={(e) => setFirstNameKa(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
              </div>
              <div className="space-y-1.5">
                <Label>{tAthletes('fields.lastNameKa')}</Label>
                <Input type="text" value={lastNameKa} onChange={(e) => setLastNameKa(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{tAthletes('fields.dateOfBirth')} *</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="h-10 bg-[var(--color-surface)]" />
            </div>
            <div className="space-y-1.5">
              <Label>{tAthletes('fields.sex')}</Label>
              <Select value={sex || EMPTY_SEX} onValueChange={(v) => setSex(v === EMPTY_SEX ? '' : v as 'MALE' | 'FEMALE')}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SEX}>—</SelectItem>
                  <SelectItem value="MALE">{tAthletes('fields.sexOptions.male')}</SelectItem>
                  <SelectItem value="FEMALE">{tAthletes('fields.sexOptions.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Club selector — admin only */}
          {scope === 'admin' && (
            <div className="space-y-1.5">
              <Label>{tAthletes('fields.club')}</Label>
              <Select
                value={clubId || EMPTY_SEX}
                onValueChange={(v) => setClubId(v === EMPTY_SEX ? '' : v)}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SEX}>—</SelectItem>
                  {(clubs ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{localizedName(c.name, c.nameKa, locale)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{tAthletes('fields.documentId')} *</Label>
            <Input
              type="text"
              value={documentId}
              onChange={(e) => { setDocumentId(e.target.value); setDocIdError(null); }}
              className="h-10 bg-[var(--color-surface)]"
            />
            {docIdError && <p className="text-[12px] text-[var(--color-danger)]">{docIdError}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
