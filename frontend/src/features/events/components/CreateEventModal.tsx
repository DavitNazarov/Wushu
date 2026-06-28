'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Stepper, type StepperStep } from '@/components/ui/Stepper';
import { ApiError, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategorySelection, EventCreateInput, EventRow, ValidationIssue } from '@/types/api';
import { AutoAdvanceToggle } from '@/features/events/components/AutoAdvanceToggle';
import { EventBasicsFields } from '@/features/events/components/EventBasicsFields';
import { EventCategoryTemplatePanel } from '@/features/events/components/EventCategoryTemplatePanel';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import { EventScheduleFields } from '@/features/events/components/EventScheduleFields';
import { EventValidationIssuesAlert } from '@/features/events/components/EventValidationIssuesAlert';
import {
  DATE_RE,
  SLUG_RE,
  addDays,
  buildEventDays,
  buildIssuesByPath,
  slugifyName,
} from '@/features/events/lib/eventForm';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEP_COUNT = 4;

/** Map a server validation path to the wizard step that owns that field. */
function stepForPath(path: string): number {
  if (path.startsWith('dates') || path.startsWith('registrationWindow')) return 1;
  if (path.startsWith('categor') || path.startsWith('ageGroups')) return 2;
  return 0;
}

export function CreateEventModal({ open, onClose }: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nameKa, setNameKa] = useState('');
  const [slug, setSlug] = useState('');
  const [location, setLocation] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [timezone, setTimezone] = useState('Asia/Tbilisi');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [registrationDays, setRegistrationDays] = useState<string[]>([]);
  const [fightDays, setFightDays] = useState<string[]>([]);
  const [regOpensAt, setRegOpensAt] = useState('');
  const [regClosesAt, setRegClosesAt] = useState('');
  const [autoAdvanceStage, setAutoAdvanceStage] = useState(false);
  const [accessType, setAccessType] = useState<'OPEN' | 'CLOSED' | ''>('');
  const [categorySelection, setCategorySelection] = useState<CategorySelection | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  const slugIsValid = !slug || SLUG_RE.test(slug);

  const eventDays = useMemo(() => buildEventDays(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const issuesByPath = useMemo(() => buildIssuesByPath(issues), [issues]);

  const latestRegistrationCloseDay = rangeStart ? addDays(rangeStart, -1) : null;
  const regOpensError =
    regOpensAt && DATE_RE.test(regOpensAt) && regClosesAt && DATE_RE.test(regClosesAt) && regOpensAt > regClosesAt
      ? tEvents('registrationWindow.errorOpensAfterCloses')
      : null;
  const regClosesError =
    regClosesAt && DATE_RE.test(regClosesAt) && (!regOpensAt || regOpensAt <= regClosesAt) && latestRegistrationCloseDay && regClosesAt > latestRegistrationCloseDay
      ? tEvents('registrationWindow.errorClosesAfterEventStart', { date: latestRegistrationCloseDay })
      : null;

  const totalSelectedCategories = (categorySelection?.ageGroups ?? []).reduce(
    (sum, ageGroup) => sum + ageGroup.weightCategoryIds.length,
    0,
  );

  // Per-step completeness — drives Next gating, stepper status and jump-ahead.
  const stepValid = useMemo(
    () => [
      Boolean(name.trim() && slug.trim() && slugIsValid && location.trim() && accessType),
      Boolean(
        rangeStart &&
          rangeEnd &&
          registrationDays.length > 0 &&
          fightDays.length > 0 &&
          !regOpensError &&
          !regClosesError,
      ),
      totalSelectedCategories > 0,
      true,
    ],
    [
      name,
      slug,
      slugIsValid,
      location,
      accessType,
      rangeStart,
      rangeEnd,
      registrationDays.length,
      fightDays.length,
      regOpensError,
      regClosesError,
      totalSelectedCategories,
    ],
  );

  const canSubmit = Boolean(!issues?.length && stepValid.every(Boolean));
  const isLastStep = step === STEP_COUNT - 1;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EventCreateInput = {
        name: name.trim(),
        nameKa: nameKa.trim() || null,
        slug: slug.trim(),
        location: location.trim().replace(/,\s*$/, ''),
        entryFee: entryFee.trim() ? Number(entryFee) : null,
        timezone: timezone.trim() || 'Asia/Tbilisi',
        autoAdvanceStage,
        accessType: accessType as 'OPEN' | 'CLOSED',
        categoryTemplateId: categorySelection?.categoryTemplateId,
        dates: {
          range: { startDate: rangeStart, endDate: rangeEnd },
          registrationDays: [...registrationDays],
          fightDays: [...fightDays],
        },
      };

      if (regOpensAt && DATE_RE.test(regOpensAt)) {
        payload.registrationWindow = { opensAt: regOpensAt };
        if (regClosesAt && DATE_RE.test(regClosesAt)) {
          payload.registrationWindow.closesAt = regClosesAt;
        }
      }

      const event = await apiPost<EventRow>('/api/events', payload);
      if (categorySelection && categorySelection.ageGroups.length > 0) {
        await apiPost(`/api/events/${event.id}/categories`, categorySelection);
      }
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast(tCommon('saveSuccess'));
      handleClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422 && error.code === 'VALIDATION_ERROR') {
        const list = Array.isArray(error.details) ? (error.details as ValidationIssue[]) : [];
        setIssues(list);
        if (list.length > 0) setStep(Math.min(...list.map((issue) => stepForPath(issue.path))));
        toast(getCompactErrorMessage(error, tCommon('error')), 'error');
        return;
      }
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error');
    },
  });

  function handleClose() {
    onClose();
    setStep(0);
    setName('');
    setNameKa('');
    setSlug('');
    setLocation('');
    setEntryFee('');
    setTimezone('Asia/Tbilisi');
    setRangeStart('');
    setRangeEnd('');
    setRegistrationDays([]);
    setFightDays([]);
    setRegOpensAt('');
    setRegClosesAt('');
    setAutoAdvanceStage(false);
    setAccessType('');
    setCategorySelection(null);
    setIssues(null);
  }

  const stepperSteps: StepperStep[] = (
    [
      { id: 'basics', label: tEvents('wizard.steps.basicsLabel'), hint: tEvents('wizard.steps.basicsHint') },
      { id: 'schedule', label: tEvents('wizard.steps.scheduleLabel'), hint: tEvents('wizard.steps.scheduleHint') },
      { id: 'categories', label: tEvents('wizard.steps.categoriesLabel'), hint: tEvents('wizard.steps.categoriesHint') },
      { id: 'review', label: tEvents('wizard.steps.reviewLabel'), hint: tEvents('wizard.steps.reviewHint') },
    ] as const
  ).map((def, index) => ({
    ...def,
    status:
      index === step
        ? 'current'
        : index < step
          ? stepValid[index]
            ? 'complete'
            : 'error'
          : 'upcoming',
    // Reachable by going back, or forward only through completed steps.
    disabled: !(index <= step || stepValid.slice(0, index).every(Boolean)),
  }));

  return (
    <EventFormDialog
      open={open}
      onClose={handleClose}
      title={tEvents('new')}
      description={tEvents('wizard.subtitle')}
      contentClassName="max-w-4xl"
      closeOnBackdrop={step === 0}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="hidden text-[12px] text-[var(--color-text-muted)] sm:block">
            {tEvents('wizard.stepCount', { current: step + 1, total: STEP_COUNT })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
            {step > 0 ? (
              <SecondaryButton onClick={() => setStep((s) => Math.max(0, s - 1))}>
                {tEvents('wizard.back')}
              </SecondaryButton>
            ) : null}
            {isLastStep ? (
              <PrimaryButton
                disabled={mutation.isPending || !canSubmit}
                onClick={() => {
                  if (!slugIsValid) {
                    toast(tCommon('error'), 'error');
                    return;
                  }
                  mutation.mutate();
                }}
              >
                {mutation.isPending ? tCommon('loading') : tEvents('wizard.create')}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                disabled={!stepValid[step]}
                onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
              >
                {tEvents('wizard.next')}
              </PrimaryButton>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Stepper steps={stepperSteps} onStepClick={(_id, index) => setStep(index)} />

        {/* Fixed-height viewport so the modal stays the same size on every step. */}
        <div className="h-[min(58vh,440px)] space-y-5 overflow-y-auto pr-1">
          {issues && issues.length > 0 ? <EventValidationIssuesAlert issues={issues} /> : null}

          {step === 0 ? (
          <div className="space-y-5">
            <StepHeader
              eyebrow={tEvents('sections.basicsEyebrow')}
              title={tEvents('sections.basicsTitle')}
              description={tEvents('sections.basicsDescription')}
            />
            <EventBasicsFields
              name={name}
              nameKa={nameKa}
              slug={slug}
              location={location}
              entryFee={entryFee}
              timezone={timezone}
              accessType={accessType}
              slugIsValid={slugIsValid}
              issuesByPath={issuesByPath}
              columns={2}
              onNameChange={(value) => {
                setName(value);
                if (!slug || slug === slugifyName(name)) setSlug(slugifyName(value));
              }}
              onNameKaChange={setNameKa}
              onSlugChange={setSlug}
              onLocationChange={setLocation}
              onEntryFeeChange={setEntryFee}
              onTimezoneChange={setTimezone}
              onAccessTypeChange={setAccessType}
            />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <StepHeader
              eyebrow={tEvents('sections.scheduleEyebrow')}
              title={tEvents('sections.scheduleTitle')}
              description={tEvents('sections.scheduleDescription')}
            />
            <EventScheduleFields
              eventDays={eventDays}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              registrationDays={registrationDays}
              fightDays={fightDays}
              regOpensAt={regOpensAt}
              regClosesAt={regClosesAt}
              regOpensError={regOpensError}
              regClosesError={regClosesError}
              latestRegistrationCloseDay={latestRegistrationCloseDay}
              issuesByPath={issuesByPath}
              onRangeStartChange={(value) => {
                setRangeStart(value);
                setRegistrationDays([]);
                setFightDays([]);
                setIssues(null);
                if (value) setRegOpensAt(addDays(value, -30));
              }}
              onRangeEndChange={(value) => {
                setRangeEnd(value);
                setRegistrationDays([]);
                setFightDays([]);
                setIssues(null);
              }}
              onRegistrationDaysChange={(days) => {
                setRegistrationDays(days);
                setIssues(null);
                if (latestRegistrationCloseDay && !regClosesAt) {
                  setRegClosesAt(latestRegistrationCloseDay);
                }
              }}
              onFightDaysChange={(days) => {
                setFightDays(days);
                setIssues(null);
              }}
              onRegOpensAtChange={(value) => {
                setRegOpensAt(value);
                setIssues(null);
              }}
              onRegClosesAtChange={(value) => {
                setRegClosesAt(value);
                setIssues(null);
              }}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <StepHeader
              eyebrow={tEvents('sections.categoriesEyebrow')}
              title={tEvents('categoryTemplates.sectionTitle')}
              description={tEvents('categoryTemplates.sectionDescription')}
            />
            <EventCategoryTemplatePanel
              open={open}
              value={categorySelection}
              onChange={setCategorySelection}
              showSelectionError={totalSelectedCategories === 0}
              embedded
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <StepHeader
              eyebrow={tEvents('wizard.review.eyebrow')}
              title={tEvents('wizard.review.title')}
              description={tEvents('wizard.review.description')}
            />
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReviewRow label={tEvents('form.nameLabel')} value={name || tEvents('wizard.review.empty')} />
              <ReviewRow label={tEvents('form.nameKaLabel')} value={nameKa || tEvents('wizard.review.empty')} />
              <ReviewRow
                label={tEvents('form.slugLabel')}
                value={slug ? `/${slug}` : tEvents('wizard.review.empty')}
              />
              <ReviewRow label={tEvents('form.locationLabel')} value={location || tEvents('wizard.review.empty')} />
              <ReviewRow label={tEvents('form.accessTypeLabel')} value={
                accessType === 'OPEN' ? tEvents('form.accessTypeOpen') :
                accessType === 'CLOSED' ? tEvents('form.accessTypeClosed') :
                tEvents('wizard.review.empty')
              } />
              <ReviewRow label={tEvents('form.entryFeeLabel')} value={entryFee ? `₾${entryFee}` : tEvents('wizard.review.empty')} />
              <ReviewRow label={tEvents('form.timezoneLabel')} value={timezone || tEvents('wizard.review.empty')} />
              <ReviewRow
                label={tEvents('form.eventDatesLabel')}
                value={
                  rangeStart && rangeEnd ? `${rangeStart} → ${rangeEnd}` : tEvents('wizard.review.empty')
                }
              />
              <ReviewRow
                label={tEvents('wizard.review.registrationDays')}
                value={
                  registrationDays.length
                    ? tEvents('wizard.review.daysCount', { count: registrationDays.length })
                    : tEvents('wizard.review.empty')
                }
              />
              <ReviewRow
                label={tEvents('wizard.review.fightDays')}
                value={
                  fightDays.length
                    ? tEvents('wizard.review.daysCount', { count: fightDays.length })
                    : tEvents('wizard.review.empty')
                }
              />
              <ReviewRow
                label={tEvents('registrationWindow.opensAt')}
                value={regOpensAt || tEvents('wizard.review.empty')}
              />
              <ReviewRow
                label={tEvents('registrationWindow.closesAt')}
                value={regClosesAt || tEvents('wizard.review.empty')}
              />
              <ReviewRow
                label={tEvents('wizard.review.categories')}
                value={tEvents('wizard.review.categoriesCount', { count: totalSelectedCategories })}
              />
            </dl>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
              <AutoAdvanceToggle
                checked={autoAdvanceStage}
                onChange={setAutoAdvanceStage}
                label={tEvents('autoAdvanceStage.label')}
                helper={tEvents('autoAdvanceStage.helper')}
              />
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </EventFormDialog>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? (
        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[13px] text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
