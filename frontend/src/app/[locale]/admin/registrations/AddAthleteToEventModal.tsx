'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Search,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Input } from '@/components/ui/primitives/input';
import { Label } from '@/components/ui/primitives/label';
import { CategoryPicker } from '@/components/registration/CategoryPicker';
import { apiGet, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage, getErrorCode, getErrorMessage } from '@/lib/api/error';
import { localizedFullName, localizedName } from '@/lib/bilingual';
import type { AthleteRow, ClubRow, RegistrationRow } from '@/types/api';

type Step = 'club' | 'athlete' | 'category';

type Props = {
  open: boolean;
  onClose: () => void;
  eventId: string;
};

// Error codes the backend may return on registration that have a friendly
// translation; anything else falls back to the compact API message.
const KNOWN_ERROR_CODES = new Set([
  'REGISTRATION_CLOSED',
  'REGISTRATION_ALREADY_EXISTS',
  'REGISTRATION_LOCKED',
  'INVALID_CATEGORY_FOR_EVENT',
  'ATHLETE_OUT_OF_AGE_GROUP',
  'ATHLETE_SEX_MISMATCH_FOR_CATEGORY',
  'EVENT_READ_ONLY',
]);

// Some backend errors arrive as a bare JSON string body (e.g. "REGISTRATION_LOCKED"),
// which the API client surfaces as a message that still contains the surrounding
// quote characters. Strip them so the code can be matched.
function normalizeErrorCode(value: string): string {
  return value.trim().replace(/^"+|"+$/g, '').trim();
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

const STEP_ORDER: Step[] = ['club', 'athlete', 'category'];

export function AddAthleteToEventModal({ open, onClose, eventId }: Props) {
  const t = useTranslations('registrations.addAthlete');
  const tC = useTranslations('common');
  const locale = useLocale();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('club');
  const [clubQuery, setClubQuery] = useState('');
  const [selectedClub, setSelectedClub] = useState<ClubRow | null>(null);
  const [athleteQuery, setAthleteQuery] = useState('');
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteRow | null>(null);
  const [ageGroupId, setAgeGroupId] = useState('');
  const [weightCategoryId, setWeightCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  // null = no result yet; otherwise the success/error outcome screen is shown.
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const { data: clubs, isLoading: clubsLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => apiGet<ClubRow[]>('/api/clubs'),
    enabled: open,
  });

  const { data: clubAthletes, isLoading: athletesLoading } = useQuery({
    queryKey: ['athletes', 'by-club', selectedClub?.id],
    queryFn: () => apiGet<AthleteRow[]>(`/api/athletes?clubId=${selectedClub!.id}`),
    enabled: open && !!selectedClub,
  });

  // Existing registrations for this event — used to flag already-registered
  // athletes so an admin doesn't try to double-register them.
  const { data: regs } = useQuery({
    queryKey: ['registrations', eventId],
    queryFn: () => apiGet<RegistrationRow[]>(`/api/registrations?eventId=${eventId}`),
    enabled: open && !!eventId,
  });

  const registeredAthleteIds = useMemo(
    () =>
      new Set(
        (regs ?? [])
          .filter((r) => r.status !== 'WITHDRAWN')
          .map((r) => r.athleteId),
      ),
    [regs],
  );

  const filteredClubs = useMemo(() => {
    const list = clubs ?? [];
    const q = clubQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nameKa?.toLowerCase().includes(q) ?? false) ||
        (c.city?.toLowerCase().includes(q) ?? false),
    );
  }, [clubs, clubQuery]);

  const filteredAthletes = useMemo(() => {
    const list = clubAthletes ?? [];
    const q = athleteQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        `${a.firstNameKa ?? ''} ${a.lastNameKa ?? ''}`.toLowerCase().includes(q) ||
        a.documentId.toLowerCase().includes(q),
    );
  }, [clubAthletes, athleteQuery]);

  const createMut = useMutation({
    mutationFn: (body: {
      eventId: string;
      athleteId: string;
      eventWeightCategoryId: string;
      notes?: string;
    }) => apiPost<RegistrationRow>('/api/registrations', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registrations', eventId] });
      setResult({ ok: true });
    },
    onError: (e) => {
      // Some backend errors carry the code in `error.code` (object payloads),
      // others throw a plain-string HttpException where the *message* is the
      // code (e.g. REGISTRATION_LOCKED). Match on either.
      const code = getErrorCode(e);
      const rawMessage = normalizeErrorCode(getErrorMessage(e, ''));
      const matched =
        code && KNOWN_ERROR_CODES.has(code)
          ? code
          : KNOWN_ERROR_CODES.has(rawMessage)
            ? rawMessage
            : null;
      const message = matched
        ? t(`errors.${matched}` as Parameters<typeof t>[0])
        : getCompactErrorMessage(e, t('errorBody'));
      setResult({ ok: false, message });
    },
  });

  function resetAll() {
    setStep('club');
    setClubQuery('');
    setSelectedClub(null);
    setAthleteQuery('');
    setSelectedAthlete(null);
    setAgeGroupId('');
    setWeightCategoryId('');
    setNotes('');
    setResult(null);
    createMut.reset();
  }

  function handleClose() {
    resetAll();
    onClose();
  }

  function pickClub(club: ClubRow) {
    setSelectedClub(club);
    setAthleteQuery('');
    setSelectedAthlete(null);
    setStep('athlete');
  }

  function pickAthlete(athlete: AthleteRow) {
    setSelectedAthlete(athlete);
    setAgeGroupId('');
    setWeightCategoryId('');
    setStep('category');
  }

  function handleRegister() {
    if (!selectedAthlete || !weightCategoryId) return;
    createMut.mutate({
      eventId,
      athleteId: selectedAthlete.id,
      eventWeightCategoryId: weightCategoryId,
      notes: notes.trim() || undefined,
    });
  }

  // Follow-up actions from the success screen.
  function addAnotherSameClub() {
    setResult(null);
    createMut.reset();
    setSelectedAthlete(null);
    setAthleteQuery('');
    setAgeGroupId('');
    setWeightCategoryId('');
    setNotes('');
    setStep('athlete');
  }

  function addAnotherClub() {
    setResult(null);
    createMut.reset();
    setSelectedClub(null);
    setClubQuery('');
    setSelectedAthlete(null);
    setAthleteQuery('');
    setAgeGroupId('');
    setWeightCategoryId('');
    setNotes('');
    setStep('club');
  }

  const clubName = selectedClub
    ? localizedName(selectedClub.name, selectedClub.nameKa, locale)
    : '';
  const athleteName = selectedAthlete
    ? localizedFullName(
        selectedAthlete.firstName,
        selectedAthlete.lastName,
        selectedAthlete.firstNameKa,
        selectedAthlete.lastNameKa,
        locale,
      )
    : '';

  // ── Result (success / error) screen ──────────────────────────────────────
  if (result) {
    return (
      <Modal open={open} onClose={handleClose} title={t('title')} widthClassName="max-w-lg">
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              result.ok
                ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                : 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]'
            }`}
          >
            {result.ok ? (
              <Check className="h-7 w-7" strokeWidth={2.5} />
            ) : (
              <AlertCircle className="h-7 w-7" strokeWidth={2.5} />
            )}
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text)]">
            {result.ok ? t('successTitle') : t('errorTitle')}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-[var(--color-text-muted)]">
            {result.ok
              ? t('successBody', { name: athleteName, club: clubName })
              : result.message}
          </p>

          {result.ok ? (
            <div className="mt-6 flex w-full flex-col gap-2">
              <PrimaryButton className="w-full" onClick={addAnotherSameClub}>
                {t('addSameClub', { club: clubName })}
              </PrimaryButton>
              <SecondaryButton className="w-full" onClick={addAnotherClub}>
                {t('addAnotherClub')}
              </SecondaryButton>
              <button
                type="button"
                onClick={handleClose}
                className="mt-1 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {t('done')}
              </button>
            </div>
          ) : (
            <div className="mt-6 flex w-full flex-col gap-2">
              <PrimaryButton
                className="w-full"
                onClick={() => {
                  setResult(null);
                  createMut.reset();
                  setStep('category');
                }}
              >
                {t('tryAgain')}
              </PrimaryButton>
              <SecondaryButton className="w-full" onClick={addAnotherClub}>
                {t('addAnotherClub')}
              </SecondaryButton>
              <button
                type="button"
                onClick={handleClose}
                className="mt-1 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {tC('close')}
              </button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // ── Stepper ───────────────────────────────────────────────────────────────
  const currentIndex = STEP_ORDER.indexOf(step);
  const stepLabels: Record<Step, string> = {
    club: t('stepClub'),
    athlete: t('stepAthlete'),
    category: t('stepCategory'),
  };

  function goToStep(target: Step) {
    // Only allow navigating to a step that's already been reached.
    if (STEP_ORDER.indexOf(target) <= currentIndex) setStep(target);
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('title')} widthClassName="max-w-lg">
      <div className="space-y-4">
        {/* Stepper */}
        <nav className="flex items-center gap-1.5" aria-label={t('title')}>
          {STEP_ORDER.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            const reachable = i <= currentIndex;
            return (
              <div key={s} className="flex flex-1 items-center gap-1.5">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goToStep(s)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex min-w-0 items-center gap-2 rounded-[var(--radius-input)] px-2 py-1 text-left transition-colors ${
                    reachable ? 'cursor-pointer hover:bg-[var(--color-surface-alt)]' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                      done
                        ? 'bg-[var(--color-success)] text-white'
                        : active
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`truncate text-[12px] font-medium ${
                      active ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
                    }`}
                  >
                    {stepLabels[s]}
                  </span>
                </button>
                {i < STEP_ORDER.length - 1 && (
                  <span
                    className={`h-px flex-1 ${done ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'}`}
                  />
                )}
              </div>
            );
          })}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* ── Step 1: Club ── */}
            {step === 'club' && (
              <div className="space-y-3">
                <SearchInput
                  value={clubQuery}
                  onChange={setClubQuery}
                  placeholder={t('searchClubs')}
                />
                <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                  {clubsLoading ? (
                    <SkeletonList />
                  ) : filteredClubs.length === 0 ? (
                    <EmptyHint text={t('noClubs')} />
                  ) : (
                    filteredClubs.map((club) => (
                      <li key={club.id}>
                        <button
                          type="button"
                          onClick={() => pickClub(club)}
                          className="group flex w-full items-center gap-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                              {localizedName(club.name, club.nameKa, locale)}
                            </span>
                            {club.city && (
                              <span className="block truncate text-[12px] text-[var(--color-text-muted)]">
                                {club.city}
                              </span>
                            )}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {/* ── Step 2: Athlete ── */}
            {step === 'athlete' && (
              <div className="space-y-3">
                <ContextChip
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  label={clubName}
                  onBack={() => setStep('club')}
                  backLabel={t('changeClub')}
                />
                <SearchInput
                  value={athleteQuery}
                  onChange={setAthleteQuery}
                  placeholder={t('searchAthletes')}
                />
                <ul className="max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
                  {athletesLoading ? (
                    <SkeletonList />
                  ) : filteredAthletes.length === 0 ? (
                    <EmptyHint text={t('noAthletes')} />
                  ) : (
                    filteredAthletes.map((a) => {
                      const registered = registeredAthleteIds.has(a.id);
                      const name = localizedFullName(
                        a.firstName,
                        a.lastName,
                        a.firstNameKa,
                        a.lastNameKa,
                        locale,
                      );
                      const year = a.dateOfBirth
                        ? new Date(a.dateOfBirth).getFullYear()
                        : null;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            disabled={registered}
                            onClick={() => pickAthlete(a)}
                            className="group flex w-full items-center gap-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left transition-colors enabled:hover:border-[var(--color-primary)]/40 enabled:hover:bg-[var(--color-surface-alt)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-alt)] text-[11px] font-semibold text-[var(--color-text-muted)]">
                              {initials(a.firstName, a.lastName)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                                {name}
                                {year ? ` (${year})` : ''}
                              </span>
                              <span className="block truncate text-[12px] text-[var(--color-text-muted)]">
                                {a.documentId}
                              </span>
                            </span>
                            {registered ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
                                <Check className="h-3 w-3" strokeWidth={3} />
                                {t('registeredBadge')}
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5" />
                            )}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            )}

            {/* ── Step 3: Category ── */}
            {step === 'category' && (
              <div className="space-y-4">
                <ContextChip
                  icon={
                    <span className="text-[10px] font-semibold">
                      {selectedAthlete
                        ? initials(selectedAthlete.firstName, selectedAthlete.lastName)
                        : ''}
                    </span>
                  }
                  label={athleteName}
                  sub={clubName}
                  onBack={() => setStep('athlete')}
                  backLabel={t('changeAthlete')}
                />

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-[var(--color-text)]">
                    {t('stepCategory')}
                  </Label>
                  <CategoryPicker
                    eventId={eventId}
                    ageGroupId={ageGroupId}
                    weightCategoryId={weightCategoryId}
                    onAgeGroupChange={setAgeGroupId}
                    onWeightCategoryChange={setWeightCategoryId}
                    disabled={createMut.isPending}
                    athlete={selectedAthlete}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-[var(--color-text)]">
                    {t('notesOptional')}
                  </Label>
                  <Input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <SecondaryButton onClick={() => setStep('athlete')}>
                    {tC('back')}
                  </SecondaryButton>
                  <PrimaryButton
                    onClick={handleRegister}
                    disabled={!weightCategoryId || createMut.isPending}
                  >
                    {createMut.isPending ? tC('loading') : t('register')}
                  </PrimaryButton>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}

// ── Local presentational helpers ────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 pl-9"
        autoFocus
      />
    </div>
  );
}

function ContextChip({
  icon,
  label,
  sub,
  onBack,
  backLabel,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onBack: () => void;
  backLabel: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
          {label}
        </span>
        {sub && (
          <span className="block truncate text-[12px] text-[var(--color-text-muted)]">{sub}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary-hover)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </button>
    </div>
  );
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-[58px] animate-pulse rounded-[var(--radius-input)] bg-[var(--color-surface-alt)]"
        />
      ))}
    </>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <li className="rounded-[var(--radius-input)] border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
      {text}
    </li>
  );
}
