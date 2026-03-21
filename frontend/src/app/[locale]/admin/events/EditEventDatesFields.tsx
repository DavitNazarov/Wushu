'use client';

import { DayPicker } from './DayPicker';
import { EventDateField } from './EventDateField';

interface DatesFieldsProps {
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
  sectionCls: string;
  onRangeStartChange: (v: string) => void;
  onRangeEndChange: (v: string) => void;
  onRegistrationDaysChange: (days: string[]) => void;
  onFightDaysChange: (days: string[]) => void;
  onRegOpensAtChange: (v: string) => void;
  onRegClosesAtChange: (v: string) => void;
  tEvents: (key: string, params?: Record<string, string>) => string;
}

export function EditEventDatesFields({
  eventDays, rangeStart, rangeEnd, registrationDays, fightDays,
  regOpensAt, regClosesAt, regOpensError, regClosesError, latestRegistrationCloseDay,
  issuesByPath, sectionCls,
  onRangeStartChange, onRangeEndChange, onRegistrationDaysChange, onFightDaysChange,
  onRegOpensAtChange, onRegClosesAtChange, tEvents,
}: DatesFieldsProps) {
  return (
    <>
      {/* Event date range */}
      <div>
        <p className={sectionCls}>Event Dates</p>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <div>
            <EventDateField
              label={tEvents('dates.start')}
              value={rangeStart}
              max={rangeEnd || undefined}
              hint={tEvents('datePicker.hints.eventStart')}
              popoverAlign="start"
              onChange={onRangeStartChange}
            />
            {issuesByPath.get('dates.range.startDate')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
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
            {issuesByPath.get('dates.range.endDate')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
            ))}
          </div>
        </div>
        {eventDays.length > 0 && (
          <div className="mt-3">
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
        )}
      </div>

      {/* Registration window */}
      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
        <p className={sectionCls}>{tEvents('registrationWindow.label')}</p>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <div>
            <EventDateField
              label={tEvents('registrationWindow.opensAt')}
              value={regOpensAt}
              max={regClosesAt || latestRegistrationCloseDay || undefined}
              hint={tEvents('datePicker.hints.registrationOpens')}
              popoverAlign="start"
              onChange={onRegOpensAtChange}
            />
            {regOpensError && (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regOpensError}</p>
            )}
            {issuesByPath.get('registrationWindow.opensAt')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
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
            {regClosesError && (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regClosesError}</p>
            )}
            {issuesByPath.get('registrationWindow.closesAt')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
