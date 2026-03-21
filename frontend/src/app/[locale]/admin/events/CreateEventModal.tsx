'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategorySelection, EventCreateInput, EventRow, ValidationIssue } from '@/types/api';
import { DayPicker } from './DayPicker';
import { EventBasicsFields } from './EventBasicsFields';
import { EventDateField } from './EventDateField';
import { EventCategoryTemplatePanel } from './EventCategoryTemplatePanel';
import { EventFormSection } from './EventFormSection';
import { EventValidationIssuesAlert } from './EventValidationIssuesAlert';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Props { open: boolean; onClose: () => void; }
export function CreateEventModal({ open, onClose }: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState('Asia/Tbilisi');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [registrationDays, setRegistrationDays] = useState<string[]>([]);
  const [fightDays, setFightDays] = useState<string[]>([]);
  const [regOpensAt, setRegOpensAt] = useState('');
  const [regClosesAt, setRegClosesAt] = useState('');
  const [autoAdvanceStage, setAutoAdvanceStage] = useState(false);
  const [categorySelection, setCategorySelection] = useState<CategorySelection | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  const slugIsValid = !slug || SLUG_RE.test(slug);

  const eventDays = useMemo<string[]>(() => {
    if (!rangeStart || !rangeEnd) return [];
    const start = new Date(rangeStart), end = new Date(rangeEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) { days.push(cursor.toISOString().slice(0, 10)); cursor.setDate(cursor.getDate() + 1); }
    return days;
  }, [rangeStart, rangeEnd]);

  const issuesByPath = useMemo(() => {
    const map = new Map<string, string[]>();
    (issues ?? []).forEach((issue) => { map.set(issue.path, [...(map.get(issue.path) ?? []), issue.message]); });
    return map;
  }, [issues]);

  const latestRegistrationCloseDay = rangeStart ? addDays(rangeStart, -1) : null;
  const regOpensError: string | null = (() => {
    if (!regOpensAt || !DATE_RE.test(regOpensAt)) return null;
    if (regClosesAt && DATE_RE.test(regClosesAt) && regOpensAt > regClosesAt) return tEvents('registrationWindow.errorOpensAfterCloses');
    return null;
  })();
  const regClosesError: string | null = (() => {
    if (!regClosesAt || !DATE_RE.test(regClosesAt)) return null;
    if (regOpensAt && DATE_RE.test(regOpensAt) && regOpensAt > regClosesAt) return null;
    if (latestRegistrationCloseDay && regClosesAt > latestRegistrationCloseDay) {
      return tEvents('registrationWindow.errorClosesAfterEventStart', {
        date: latestRegistrationCloseDay,
      });
    }
    return null;
  })();

  const totalSelectedCats = (categorySelection?.ageGroups ?? []).reduce((s, ag) => s + ag.weightCategoryIds.length, 0);

  const canSubmit =
    !issues?.length && name.trim() && slug.trim() && slugIsValid &&
    location.trim() && rangeStart && rangeEnd &&
    registrationDays.length > 0 && fightDays.length > 0 &&
    !regOpensError && !regClosesError && totalSelectedCats > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EventCreateInput = {
        name: name.trim(), slug: slug.trim(),
        location: location.trim().replace(/,\s*$/, ''),
        timezone: timezone.trim() || 'Asia/Tbilisi',
        autoAdvanceStage,
        categoryTemplateId: categorySelection?.categoryTemplateId,
        dates: { range: { startDate: rangeStart, endDate: rangeEnd }, registrationDays: [...registrationDays], fightDays: [...fightDays] },
      };
      if (regOpensAt && DATE_RE.test(regOpensAt)) {
        payload.registrationWindow = { opensAt: regOpensAt };
        if (regClosesAt && DATE_RE.test(regClosesAt)) payload.registrationWindow.closesAt = regClosesAt;
      }
      const event = await apiPost<EventRow>('/api/events', payload);
      if (categorySelection && categorySelection.ageGroups.length > 0) {
        await apiPost(`/api/events/${event.id}/categories`, categorySelection);
      }
      return event;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); toast(tCommon('saveSuccess')); handleClose(); },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422 && err.code === 'VALIDATION_ERROR') {
        setIssues(Array.isArray(err.details) ? (err.details as ValidationIssue[]) : []);
        toast(getCompactErrorMessage(err, tCommon('error')), 'error'); return;
      }
      toast(getCompactErrorMessage(err, tCommon('saveFailed')), 'error');
    },
  });

  function handleClose() {
    onClose();
    setName(''); setSlug(''); setLocation(''); setTimezone('Asia/Tbilisi');
    setRangeStart(''); setRangeEnd(''); setRegistrationDays([]); setFightDays([]);
    setRegOpensAt(''); setRegClosesAt(''); setAutoAdvanceStage(false);
    setCategorySelection(null); setCategoryError(null); setIssues(null);
  }

  const inputCls = 'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
  const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]';

  return (
    <Modal open={open} onClose={handleClose} title={tEvents('new')} description={tEvents('emptyDescription')} widthClassName="max-w-3xl"
      footer={
        <>
          <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton disabled={mutation.isPending || !canSubmit} onClick={() => { if (!slugIsValid) { toast(tCommon('error'), 'error'); return; } mutation.mutate(); }}>
            {mutation.isPending ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        {issues && issues.length > 0 && (
          <EventValidationIssuesAlert issues={issues} />
        )}

        <EventFormSection
          eyebrow={tEvents('sections.basicsEyebrow')}
          title={tEvents('sections.basicsTitle')}
          description={tEvents('sections.basicsDescription')}
        >
          <EventBasicsFields
            name={name}
            slug={slug}
            location={location}
            timezone={timezone}
            slugIsValid={slugIsValid}
            inputCls={inputCls}
            labelCls={labelCls}
            issuesByPath={issuesByPath}
            tEvents={(key) => tEvents(key as Parameters<typeof tEvents>[0])}
            onNameChange={(value) => {
              setName(value);
              if (!slug || slug === slugifyName(name)) setSlug(slugifyName(value));
            }}
            onSlugChange={setSlug}
            onLocationChange={setLocation}
            onTimezoneChange={setTimezone}
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.scheduleEyebrow')}
          title={tEvents('sections.scheduleTitle')}
          description={tEvents('sections.scheduleDescription')}
        >
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div>
              <EventDateField
                label={tEvents('dates.start')}
                value={rangeStart}
                max={rangeEnd || undefined}
                hint={tEvents('datePicker.hints.eventStart')}
                popoverAlign="start"
                onChange={(nextValue) => {
                  setRangeStart(nextValue);
                  setRegistrationDays([]);
                  setFightDays([]);
                  setIssues(null);
                  if (nextValue) setRegOpensAt(addDays(nextValue, -30));
                }}
              />
              {issuesByPath.get('dates.range.startDate')?.map((msg, i) => <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>)}
            </div>
            <div>
              <EventDateField
                label={tEvents('dates.end')}
                value={rangeEnd}
                min={rangeStart || undefined}
                hint={tEvents('datePicker.hints.eventEnd')}
                popoverAlign="end"
                onChange={(nextValue) => {
                  setRangeEnd(nextValue);
                  setRegistrationDays([]);
                  setFightDays([]);
                  setIssues(null);
                }}
              />
              {issuesByPath.get('dates.range.endDate')?.map((msg, i) => <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>)}
            </div>
          </div>
          {eventDays.length > 0 && (
            <div className="mt-3">
              <DayPicker
                days={eventDays}
                registrationDays={registrationDays}
                fightDays={fightDays}
                onRegistrationChange={(days) => {
                  setRegistrationDays(days);
                  setIssues(null);
                  if (latestRegistrationCloseDay && !regClosesAt) {
                    setRegClosesAt(latestRegistrationCloseDay);
                  }
                }}
                onFightChange={(days) => { setFightDays(days); setIssues(null); }}
                errors={[...(issuesByPath.get('dates.registrationDays') ?? []), ...(issuesByPath.get('dates.fightDays') ?? [])]}
              />
            </div>
          )}
          <div className="mt-6 grid items-end gap-3 sm:grid-cols-2">
            <div>
              <EventDateField
                label={tEvents('registrationWindow.opensAt')}
                value={regOpensAt}
                max={regClosesAt || latestRegistrationCloseDay || undefined}
                hint={tEvents('datePicker.hints.registrationOpens')}
                popoverAlign="start"
                onChange={(nextValue) => { setRegOpensAt(nextValue); setIssues(null); }}
              />
              {regOpensError && <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regOpensError}</p>}
              {issuesByPath.get('registrationWindow.opensAt')?.map((msg, i) => <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>)}
            </div>
            <div>
              <EventDateField
                label={tEvents('registrationWindow.closesAt')}
                value={regClosesAt}
                min={regOpensAt || undefined}
                max={latestRegistrationCloseDay || undefined}
                popoverAlign="end"
                hint={
                  !regClosesAt && latestRegistrationCloseDay
                    ? tEvents('registrationWindow.closesAtAuto', { date: latestRegistrationCloseDay })
                    : tEvents('datePicker.hints.registrationCloses')
                }
                onChange={(nextValue) => { setRegClosesAt(nextValue); setIssues(null); }}
              />
              {regClosesError && <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regClosesError}</p>}
              {issuesByPath.get('registrationWindow.closesAt')?.map((msg, i) => <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>)}
            </div>
          </div>
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.categoriesEyebrow')}
          title={tEvents('categoryTemplates.sectionTitle')}
          description={tEvents('categoryTemplates.sectionDescription')}
        >
          <EventCategoryTemplatePanel
            open={open}
            value={categorySelection}
            onChange={(value) => {
              setCategorySelection(value);
              setCategoryError(null);
            }}
            error={categoryError}
            showSelectionError={totalSelectedCats === 0}
            embedded
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.lifecycleEyebrow')}
          title={tEvents('sections.lifecycleTitle')}
          description={tEvents('sections.lifecycleDescription')}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <span className="relative mt-0.5 flex-shrink-0">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={autoAdvanceStage}
                onChange={(e) => setAutoAdvanceStage(e.target.checked)}
              />
              <span
                className={[
                  'block h-[18px] w-[18px] rounded-[4px] border transition-all duration-[120ms] ease-in-out',
                  'border-[var(--color-border)] bg-[var(--color-surface)]',
                  'peer-checked:scale-[1.08] peer-checked:border-[var(--color-primary)] peer-checked:bg-[var(--color-primary)]',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)]/40',
                ].join(' ')}
              >
                {autoAdvanceStage && (
                  <svg className="absolute inset-0 m-auto h-[11px] w-[11px] text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </span>
            <span>
              <span className="block text-[13px] text-[var(--color-text)]">
                {tEvents('autoAdvanceStage.label')}
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">
                {tEvents('autoAdvanceStage.helper')}
              </span>
            </span>
          </label>
        </EventFormSection>
      </div>
    </Modal>
  );
}
