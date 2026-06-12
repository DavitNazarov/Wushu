'use client';

import { useTranslations } from 'next-intl';
import { DayPicker } from '@/features/events/components/DayPicker';
import { EventDateField } from '@/features/events/components/EventDateField';

interface EventScheduleFieldsProps {
  eventDays: string[];
  rangeStart: string;
  rangeEnd: string;
  registrationDays: string[];
  fightDays: string[];
  regOpensAt: string;
  regClosesAt: string;
  regOpensError: string | null;
  regClosesError: string | null;
  latestRegistrationCloseDay: string | null;
  issuesByPath: Map<string, string[]>;
  onRangeStartChange: (value: string) => void;
  onRangeEndChange: (value: string) => void;
  onRegistrationDaysChange: (days: string[]) => void;
  onFightDaysChange: (days: string[]) => void;
  onRegOpensAtChange: (value: string) => void;
  onRegClosesAtChange: (value: string) => void;
}

export function EventScheduleFields({
  eventDays,
  rangeStart,
  rangeEnd,
  registrationDays,
  fightDays,
  regOpensAt,
  regClosesAt,
  regOpensError,
  regClosesError,
  latestRegistrationCloseDay,
  issuesByPath,
  onRangeStartChange,
  onRangeEndChange,
  onRegistrationDaysChange,
  onFightDaysChange,
  onRegOpensAtChange,
  onRegClosesAtChange,
}: EventScheduleFieldsProps) {
  const tEvents = useTranslations('admin.events');
  const subsectionClassName = 'mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]';

  return (
    <div className="space-y-6">
      <div>
        <p className={subsectionClassName}>{tEvents('form.eventDatesLabel')}</p>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <div>
            <EventDateField
              label={tEvents('dates.start')}
              value={rangeStart}
              max={rangeEnd || undefined}
              hint={tEvents('datePicker.hints.eventStart')}
              popoverAlign="start"
              onChange={onRangeStartChange}
            />
            {issuesByPath.get('dates.range.startDate')?.map((message, index) => (
              <p key={index} className="mt-1 text-[12px] text-[var(--color-danger)]">
                {message}
              </p>
            ))}
          </div>
          <div>
            <EventDateField
              label={tEvents('dates.end')}
              value={rangeEnd}
              min={rangeStart || undefined}
              hint={tEvents('datePicker.hints.eventEnd')}
              popoverAlign="end"
              onChange={onRangeEndChange}
            />
            {issuesByPath.get('dates.range.endDate')?.map((message, index) => (
              <p key={index} className="mt-1 text-[12px] text-[var(--color-danger)]">
                {message}
              </p>
            ))}
          </div>
        </div>

        {eventDays.length > 0 ? (
          <div className="mt-4">
            <DayPicker
              days={eventDays}
              registrationDays={registrationDays}
              fightDays={fightDays}
              onRegistrationChange={onRegistrationDaysChange}
              onFightChange={onFightDaysChange}
              errors={[
                ...(issuesByPath.get('dates.registrationDays') ?? []),
                ...(issuesByPath.get('dates.fightDays') ?? []),
              ]}
            />
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--color-border)] pt-5">
        <p className={subsectionClassName}>{tEvents('registrationWindow.label')}</p>
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <div>
            <EventDateField
              label={tEvents('registrationWindow.opensAt')}
              value={regOpensAt}
              max={regClosesAt || latestRegistrationCloseDay || undefined}
              hint={tEvents('datePicker.hints.registrationOpens')}
              popoverAlign="start"
              onChange={onRegOpensAtChange}
            />
            {regOpensError ? (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regOpensError}</p>
            ) : null}
            {issuesByPath.get('registrationWindow.opensAt')?.map((message, index) => (
              <p key={index} className="mt-1 text-[12px] text-[var(--color-danger)]">
                {message}
              </p>
            ))}
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
              onChange={onRegClosesAtChange}
            />
            {regClosesError ? (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regClosesError}</p>
            ) : null}
            {issuesByPath.get('registrationWindow.closesAt')?.map((message, index) => (
              <p key={index} className="mt-1 text-[12px] text-[var(--color-danger)]">
                {message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
