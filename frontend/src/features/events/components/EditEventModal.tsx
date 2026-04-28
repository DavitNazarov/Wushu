'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { AutoAdvanceToggle } from '@/features/events/components/AutoAdvanceToggle';
import { EventBasicsFields } from '@/features/events/components/EventBasicsFields';
import { EventFormActions } from '@/features/events/components/EventFormActions';
import { EventCategoryTemplatePanel } from '@/features/events/components/EventCategoryTemplatePanel';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import { EventFormSection } from '@/features/events/components/EventFormSection';
import { EventScheduleFields } from '@/features/events/components/EventScheduleFields';
import { EventValidationIssuesAlert } from '@/features/events/components/EventValidationIssuesAlert';
import { DATE_RE, SLUG_RE, addDays, buildEventDays, buildInitialCategorySelection, buildIssuesByPath, getInitialEventDateFields } from '@/features/events/lib/eventForm';

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

  const { rangeStart: initRangeStart, rangeEnd: initRangeEnd, registrationDays: initRegDays, fightDays: initFightDays, regOpensAt: initRegOpensAt, regClosesAt: initRegClosesAt } = useMemo(
    () => getInitialEventDateFields(event),
    [event],
  );

  const [name, setName] = useState(event.name);
  const [nameKa, setNameKa] = useState(event.nameKa ?? '');
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

  const { data: existingCategories } = useQuery({
    queryKey: ['event-categories', event.id],
    queryFn: () => apiGet<EventCategoriesResponse>(`/api/events/${event.id}/categories`),
    enabled: open,
  });

  const initialCategorySelection = useMemo(
    () => buildInitialCategorySelection(existingCategories, event.categoryTemplateId),
    [event.categoryTemplateId, existingCategories],
  );

  const effectiveCategorySelection = categorySelection ?? initialCategorySelection;
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

  const totalSelectedCategories = (effectiveCategorySelection?.ageGroups ?? []).reduce(
    (sum, ageGroup) => sum + ageGroup.weightCategoryIds.length,
    0,
  );

  const canSubmit = Boolean(
    !issues?.length &&
    name.trim() &&
    slug.trim() &&
    slugIsValid &&
    location.trim() &&
    rangeStart &&
    rangeEnd &&
    registrationDays.length > 0 &&
    fightDays.length > 0 &&
    !regOpensError &&
    !regClosesError &&
    (!effectiveCategorySelection || totalSelectedCategories > 0),
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EventCreateInput = {
        name: name.trim(),
        nameKa: nameKa.trim() || null,
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

      const updatedEvent = await apiPatch<EventRow>(`/api/events/${event.id}`, payload);
      if (effectiveCategorySelection && effectiveCategorySelection.ageGroups.length > 0) {
        await apiPost(`/api/events/${event.id}/categories`, effectiveCategorySelection);
        queryClient.invalidateQueries({ queryKey: ['event-categories', event.id] });
      }
      return updatedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-detail', event.id] });
      toast(tCommon('saveSuccess'));
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422 && error.code === 'VALIDATION_ERROR') {
        setIssues(Array.isArray(error.details) ? (error.details as ValidationIssue[]) : []);
        toast(getCompactErrorMessage(error, tCommon('error')), 'error');
        return;
      }
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error');
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
    setNameKa(event.nameKa ?? '');
    setSlug(event.slug);
    setLocation(event.location ?? '');
    setTimezone(event.timezone);
    setAutoAdvanceStage(event.autoAdvanceStage ?? false);
    resetDates();
    setIssues(null);
    onClose();
  }

  return (
    <EventFormDialog
      open={open}
      onClose={handleClose}
      title={tEvents('edit.title')}
      description={tEvents('edit.description')}
      footer={
        <EventFormActions
          canSubmit={canSubmit}
          isPending={mutation.isPending}
          onCancel={handleClose}
          onSubmit={() => mutation.mutate()}
        />
      }
    >
      <div className="space-y-5">
        {issues && issues.length > 0 ? <EventValidationIssuesAlert issues={issues} /> : null}

        <EventFormSection
          eyebrow={tEvents('sections.basicsEyebrow')}
          title={tEvents('sections.basicsTitle')}
          description={tEvents('sections.basicsDescription')}
        >
          <EventBasicsFields
            name={name}
            nameKa={nameKa}
            slug={slug}
            location={location}
            timezone={timezone}
            slugIsValid={slugIsValid}
            issuesByPath={issuesByPath}
            onNameChange={(value) => {
              setName(value);
              setIssues(null);
            }}
            onNameKaChange={setNameKa}
            onSlugChange={(value) => {
              setSlug(value);
              setIssues(null);
            }}
            onLocationChange={setLocation}
            onTimezoneChange={setTimezone}
          />
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.scheduleEyebrow')}
          title={tEvents('sections.scheduleTitle')}
          description={tEvents('sections.scheduleDescription')}
        >
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
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.categoriesEyebrow')}
          title={tEvents('categoryTemplates.sectionTitle')}
          description={tEvents('categoryTemplates.sectionDescription')}
        >
          <EventCategoryTemplatePanel
            open={open}
            value={effectiveCategorySelection}
            onChange={setCategorySelection}
            showSelectionError={!!effectiveCategorySelection && totalSelectedCategories === 0}
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
    </EventFormDialog>
  );
}
