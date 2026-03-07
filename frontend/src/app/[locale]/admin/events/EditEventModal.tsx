'use client';

import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import type { CategorySelection, EventCategoriesResponse, EventCreateInput, EventRow, RulesetRow, ValidationIssue } from '@/types/api';
import { EditEventDatesFields } from './EditEventDatesFields';
import { AutoAdvanceToggle } from './AutoAdvanceToggle';
import { CategorySelector } from './CategorySelector';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoToDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  event: EventRow;
}

export function EditEventModal({ open, onClose, event }: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initRangeStart = event.dates?.range.startDate ?? isoToDate(event.competitionStartDate);
  const initRangeEnd = event.dates?.range.endDate ?? isoToDate(event.competitionEndDate);
  const initRegDays = event.dates?.registrationDays ?? [isoToDate(event.registrationStartDate)].filter(Boolean);
  const initFightDays = event.dates?.fightDays ?? [isoToDate(event.competitionStartDate)].filter(Boolean);
  const initRegOpensAt = event.dates?.registrationWindow?.opensAt ?? isoToDate(event.registrationOpensAt);
  const initRegClosesAt = event.dates?.registrationWindow?.closesAt ?? isoToDate(event.registrationClosesAt);

  const [name, setName] = useState(event.name);
  const [slug, setSlug] = useState(event.slug);
  const [location, setLocation] = useState(event.location ?? '');
  const [timezone, setTimezone] = useState(event.timezone);
  const [rangeStart, setRangeStart] = useState(initRangeStart);
  const [rangeEnd, setRangeEnd] = useState(initRangeEnd);
  const [registrationDays, setRegistrationDays] = useState<string[]>(initRegDays);
  const [fightDays, setFightDays] = useState<string[]>(initFightDays);
  const [regOpensAt, setRegOpensAt] = useState(initRegOpensAt);
  const [regClosesAt, setRegClosesAt] = useState(initRegClosesAt);
  const [autoAdvanceStage, setAutoAdvanceStage] = useState(event.autoAdvanceStage ?? false);
  const [categorySelection, setCategorySelection] = useState<CategorySelection | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);

  const { data: rulesets } = useQuery({
    queryKey: ['rulesets'],
    queryFn: () => apiGet<RulesetRow[]>('/api/rulesets'),
    enabled: open,
  });

  // Load existing categories once and init the selection state
  const { data: existingCategories } = useQuery({
    queryKey: ['event-categories', event.id],
    queryFn: () => apiGet<EventCategoriesResponse>(`/api/events/${event.id}/categories`),
    enabled: open,
  });

  // When data arrives and selection hasn't been set yet, initialise from existing categories
  useEffect(() => {
    if (!existingCategories || categorySelection !== null || !rulesets?.length) return;
    if (!existingCategories.ageGroups.length) return;
    const rulesetId = rulesets[0].id;
    setCategorySelection({
      rulesetId,
      ageGroups: existingCategories.ageGroups.map((ag) => ({
        rulesetAgeGroupId: ag.rulesetAgeGroupId,
        weightCategoryIds: ag.weightCategories.map((wc) => wc.rulesetWeightCategoryId),
      })),
    });
  }, [existingCategories, rulesets, categorySelection]);

  const slugIsValid = !slug || SLUG_RE.test(slug);

  const eventDays = useMemo<string[]>(() => {
    if (!rangeStart || !rangeEnd) return [];
    const start = new Date(rangeStart), end = new Date(rangeEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];
    const days: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [rangeStart, rangeEnd]);

  const issuesByPath = useMemo(() => {
    const map = new Map<string, string[]>();
    (issues ?? []).forEach((issue) => {
      map.set(issue.path, [...(map.get(issue.path) ?? []), issue.message]);
    });
    return map;
  }, [issues]);

  const minWeighinDay = registrationDays.length ? [...registrationDays].sort()[0] : null;

  const regOpensError: string | null = (() => {
    if (!regOpensAt || !DATE_RE.test(regOpensAt)) return null;
    if (regClosesAt && DATE_RE.test(regClosesAt) && regOpensAt > regClosesAt)
      return tEvents('registrationWindow.errorOpensAfterCloses');
    return null;
  })();

  const regClosesError: string | null = (() => {
    if (!regClosesAt || !DATE_RE.test(regClosesAt)) return null;
    if (regOpensAt && DATE_RE.test(regOpensAt) && regOpensAt > regClosesAt) return null;
    if (minWeighinDay && regClosesAt > minWeighinDay)
      return tEvents('registrationWindow.errorClosesAfterWeighin', { date: minWeighinDay });
    return null;
  })();

  const canSubmit =
    !issues?.length &&
    name.trim() && slug.trim() && slugIsValid &&
    location.trim() && rangeStart && rangeEnd &&
    registrationDays.length > 0 && fightDays.length > 0 &&
    !regOpensError && !regClosesError;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EventCreateInput = {
        name: name.trim(),
        slug: slug.trim(),
        location: location.trim().replace(/,\s*$/, ''),
        timezone: timezone.trim() || 'Asia/Tbilisi',
        autoAdvanceStage,
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
      const updated = await apiPatch<EventRow>(`/api/events/${event.id}`, payload);
      if (categorySelection && categorySelection.ageGroups.length > 0) {
        await apiPost(`/api/events/${event.id}/categories`, categorySelection);
        queryClient.invalidateQueries({ queryKey: ['event-categories', event.id] });
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-detail', event.id] });
      toast(tCommon('saveSuccess'));
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422 && err.code === 'VALIDATION_ERROR') {
        setIssues(Array.isArray(err.details) ? (err.details as ValidationIssue[]) : []);
        toast(tCommon('error'), 'error');
        return;
      }
      toast(err instanceof ApiError ? err.message : tCommon('saveFailed'), 'error');
    },
  });

  function resetDates() {
    setRangeStart(initRangeStart);
    setRangeEnd(initRangeEnd);
    setRegistrationDays(initRegDays);
    setFightDays(initFightDays);
    setRegOpensAt(initRegOpensAt);
    setRegClosesAt(initRegClosesAt);
  }

  function handleClose() {
    setName(event.name);
    setSlug(event.slug);
    setLocation(event.location ?? '');
    setTimezone(event.timezone);
    setAutoAdvanceStage(event.autoAdvanceStage ?? false);
    resetDates();
    setIssues(null);
    onClose();
  }

  const inputCls =
    'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
  const labelCls = 'mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]';
  const sectionCls = 'mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]';

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={tEvents('edit.title')}
      description={tEvents('edit.description')}
      footer={
        <>
          <SecondaryButton onClick={handleClose}>{tCommon('cancel')}</SecondaryButton>
          <PrimaryButton
            disabled={mutation.isPending || !canSubmit}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? tCommon('loading') : tCommon('save')}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        {issues && issues.length > 0 && (
          <InlineAlert variant="error">
            <p className="text-[12px] font-medium">
              {tCommon('error')}: {tEvents('validation.summary')}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px]">
              {issues.slice(0, 5).map((issue, idx) => (
                <li key={idx}>
                  <span className="font-mono">{issue.path}</span>: {issue.message}
                </li>
              ))}
              {issues.length > 5 && <li>… {issues.length - 5} more</li>}
            </ul>
          </InlineAlert>
        )}

        {/* Name */}
        <div>
          <label className={labelCls}>{tEvents('columns.name')}</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => { setName(e.target.value); setIssues(null); }}
          />
        </div>

        {/* Slug */}
        <div>
          <label className={labelCls}>Slug</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px] text-[var(--color-text-muted)]">/</span>
            <input
              className={`${inputCls} pl-6`}
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setIssues(null); }}
            />
          </div>
          {!slugIsValid && (
            <p className="mt-1 text-[12px] text-[var(--color-danger)]">
              Lowercase letters, numbers, and dashes only
            </p>
          )}
          {issuesByPath.get('slug')?.map((msg, i) => (
            <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
          ))}
        </div>

        {/* Location + Timezone */}
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{tEvents('columns.location')}</label>
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>{tEvents('timezone')}</label>
            <input
              className={inputCls}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>

        <EditEventDatesFields
          eventDays={eventDays}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          registrationDays={registrationDays}
          fightDays={fightDays}
          regOpensAt={regOpensAt}
          regClosesAt={regClosesAt}
          regOpensError={regOpensError}
          regClosesError={regClosesError}
          minWeighinDay={minWeighinDay}
          issuesByPath={issuesByPath}
          inputCls={inputCls}
          labelCls={labelCls}
          sectionCls={sectionCls}
          onRangeStartChange={(v) => { setRangeStart(v); setRegistrationDays([]); setFightDays([]); setIssues(null); }}
          onRangeEndChange={(v) => { setRangeEnd(v); setRegistrationDays([]); setFightDays([]); setIssues(null); }}
          onRegistrationDaysChange={(days) => { setRegistrationDays(days); setIssues(null); if (days.length && !regClosesAt) setRegClosesAt([...days].sort()[0]); }}
          onFightDaysChange={(days) => { setFightDays(days); setIssues(null); }}
          onRegOpensAtChange={(v) => { setRegOpensAt(v); setIssues(null); }}
          onRegClosesAtChange={(v) => { setRegClosesAt(v); setIssues(null); }}
          tEvents={(key, params) => tEvents(key as Parameters<typeof tEvents>[0], params as Parameters<typeof tEvents>[1])}
        />

        {/* Competition rules */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
          <p className={sectionCls}>Competition Rules</p>
          {rulesets && rulesets.length > 0 ? (
            <CategorySelector
              rulesets={rulesets}
              value={categorySelection}
              onChange={(v) => setCategorySelection(v)}
            />
          ) : (
            <p className="text-[12px] text-[var(--color-text-muted)]">Loading rulesets…</p>
          )}
        </div>

        {/* Lifecycle automation */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
          <p className={sectionCls}>Lifecycle</p>
          <AutoAdvanceToggle
            checked={autoAdvanceStage}
            onChange={setAutoAdvanceStage}
            label={tEvents('autoAdvanceStage.label')}
            helper={tEvents('autoAdvanceStage.helper')}
          />
        </div>
      </div>
    </Modal>
  );
}
