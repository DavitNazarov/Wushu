'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { ApiError, apiPost } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import type { CategorySelection, EventCreateInput, EventRow, ValidationIssue } from '@/types/api';
import { AutoAdvanceToggle } from '@/features/events/components/AutoAdvanceToggle';
import { EventBasicsFields } from '@/features/events/components/EventBasicsFields';
import { EventFormActions } from '@/features/events/components/EventFormActions';
import { EventCategoryTemplatePanel } from '@/features/events/components/EventCategoryTemplatePanel';
import { EventFormDialog } from '@/features/events/components/EventFormDialog';
import { EventFormSection } from '@/features/events/components/EventFormSection';
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

export function CreateEventModal({ open, onClose }: Props) {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [nameKa, setNameKa] = useState('');
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
    totalSelectedCategories > 0,
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
        setIssues(Array.isArray(error.details) ? (error.details as ValidationIssue[]) : []);
        toast(getCompactErrorMessage(error, tCommon('error')), 'error');
        return;
      }
      toast(getCompactErrorMessage(error, tCommon('saveFailed')), 'error');
    },
  });

  function handleClose() {
    onClose();
    setName('');
    setNameKa('');
    setSlug('');
    setLocation('');
    setTimezone('Asia/Tbilisi');
    setRangeStart('');
    setRangeEnd('');
    setRegistrationDays([]);
    setFightDays([]);
    setRegOpensAt('');
    setRegClosesAt('');
    setAutoAdvanceStage(false);
    setCategorySelection(null);
    setIssues(null);
  }

  return (
    <EventFormDialog
      open={open}
      onClose={handleClose}
      title={tEvents('new')}
      description={tEvents('emptyDescription')}
      footer={
        <EventFormActions
          canSubmit={canSubmit}
          isPending={mutation.isPending}
          onCancel={handleClose}
          onSubmit={() => {
            if (!slugIsValid) {
              toast(tCommon('error'), 'error');
              return;
            }
            mutation.mutate();
          }}
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
              if (!slug || slug === slugifyName(name)) setSlug(slugifyName(value));
            }}
            onNameKaChange={setNameKa}
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
        </EventFormSection>

        <EventFormSection
          eyebrow={tEvents('sections.categoriesEyebrow')}
          title={tEvents('categoryTemplates.sectionTitle')}
          description={tEvents('categoryTemplates.sectionDescription')}
        >
          <EventCategoryTemplatePanel
            open={open}
            value={categorySelection}
            onChange={setCategorySelection}
            showSelectionError={totalSelectedCategories === 0}
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
