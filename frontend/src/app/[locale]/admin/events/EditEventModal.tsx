'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type {
  CategorySelection,
  EventCategoriesResponse,
  EventCreateInput,
  EventRow,
  ValidationIssue,
} from '@/types/api';
import { EditEventDatesFields } from './EditEventDatesFields';
import { AutoAdvanceToggle } from './AutoAdvanceToggle';
import { EventBasicsFields } from './EventBasicsFields';
import { EventCategoryTemplatePanel } from './EventCategoryTemplatePanel';
import { EventFormSection } from './EventFormSection';
import { EventValidationIssuesAlert } from './EventValidationIssuesAlert';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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

  // Load existing categories once and init the selection state
  const { data: existingCategories } = useQuery({
    queryKey: ['event-categories', event.id],
    queryFn: () => apiGet<EventCategoriesResponse>(`/api/events/${event.id}/categories`),
    enabled: open,
  });

  const initialCategorySelection = useMemo<CategorySelection | null>(() => {
    if (!existingCategories) return null;
    if (!existingCategories.ageGroups.length) return null;
    return {
      categoryTemplateId:
        existingCategories.categoryTemplateId ?? event.categoryTemplateId ?? '',
      ageGroups: existingCategories.ageGroups.map((ag) => ({
        categoryTemplateGroupId: ag.categoryTemplateGroupId,
        weightCategoryIds: ag.weightCategories.map(
          (wc) => wc.categoryTemplateCategoryId,
        ),
      })),
    };
  }, [event.categoryTemplateId, existingCategories]);
  const effectiveCategorySelection = categorySelection ?? initialCategorySelection;

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

  const latestRegistrationCloseDay = rangeStart ? addDays(rangeStart, -1) : null;

  const regOpensError: string | null = (() => {
    if (!regOpensAt || !DATE_RE.test(regOpensAt)) return null;
    if (regClosesAt && DATE_RE.test(regClosesAt) && regOpensAt > regClosesAt)
      return tEvents('registrationWindow.errorOpensAfterCloses');
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

  const totalSelectedCats = (effectiveCategorySelection?.ageGroups ?? []).reduce(
    (sum, ageGroup) => sum + ageGroup.weightCategoryIds.length,
    0,
  );

  const canSubmit =
    !issues?.length &&
    name.trim() && slug.trim() && slugIsValid &&
    location.trim() && rangeStart && rangeEnd &&
    registrationDays.length > 0 && fightDays.length > 0 &&
    !regOpensError && !regClosesError &&
    (!effectiveCategorySelection || totalSelectedCats > 0);

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
      if (effectiveCategorySelection && effectiveCategorySelection.ageGroups.length > 0) {
        await apiPost(`/api/events/${event.id}/categories`, effectiveCategorySelection);
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
        toast(getCompactErrorMessage(err, tCommon('error')), 'error');
        return;
      }
      toast(getCompactErrorMessage(err, tCommon('saveFailed')), 'error');
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
      widthClassName="max-w-3xl"
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
            onNameChange={(value) => { setName(value); setIssues(null); }}
            onSlugChange={(value) => { setSlug(value); setIssues(null); }}
            onLocationChange={setLocation}
            onTimezoneChange={setTimezone}
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.scheduleEyebrow')}
          title={tEvents('sections.scheduleTitle')}
          description={tEvents('sections.scheduleDescription')}
        >
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
            latestRegistrationCloseDay={latestRegistrationCloseDay}
            issuesByPath={issuesByPath}
            sectionCls={sectionCls}
            onRangeStartChange={(v) => { setRangeStart(v); setRegistrationDays([]); setFightDays([]); setIssues(null); }}
            onRangeEndChange={(v) => { setRangeEnd(v); setRegistrationDays([]); setFightDays([]); setIssues(null); }}
            onRegistrationDaysChange={(days) => {
              setRegistrationDays(days);
              setIssues(null);
              if (latestRegistrationCloseDay && !regClosesAt) {
                setRegClosesAt(latestRegistrationCloseDay);
              }
            }}
            onFightDaysChange={(days) => { setFightDays(days); setIssues(null); }}
            onRegOpensAtChange={(v) => { setRegOpensAt(v); setIssues(null); }}
            onRegClosesAtChange={(v) => { setRegClosesAt(v); setIssues(null); }}
            tEvents={(key, params) => tEvents(key as Parameters<typeof tEvents>[0], params as Parameters<typeof tEvents>[1])}
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.categoriesEyebrow')}
          title={tEvents('categoryTemplates.sectionTitle')}
          description={tEvents('categoryTemplates.sectionDescription')}
        >
          <EventCategoryTemplatePanel
            open={open}
            value={effectiveCategorySelection}
            onChange={(value) => setCategorySelection(value)}
            showSelectionError={!!effectiveCategorySelection && totalSelectedCats === 0}
            embedded
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.lifecycleEyebrow')}
          title={tEvents('sections.lifecycleTitle')}
          description={tEvents('sections.lifecycleDescription')}
        >
          <AutoAdvanceToggle
            checked={autoAdvanceStage}
            onChange={setAutoAdvanceStage}
            label={tEvents('autoAdvanceStage.label')}
            helper={tEvents('autoAdvanceStage.helper')}
          />
        </EventFormSection>
      </div>
    </Modal>
  );
}
