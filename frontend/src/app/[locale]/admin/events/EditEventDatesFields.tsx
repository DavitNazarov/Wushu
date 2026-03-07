'use client';

import { DayPicker } from './DayPicker';

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
  minWeighinDay: string | null;
  issuesByPath: Map<string, string[]>;
  inputCls: string;
  labelCls: string;
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
  regOpensAt, regClosesAt, regOpensError, regClosesError, minWeighinDay,
  issuesByPath, inputCls, labelCls, sectionCls,
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
            <label className={labelCls}>{tEvents('dates.start')}</label>
            <input type="date" className={inputCls} value={rangeStart}
              onChange={(e) => onRangeStartChange(e.target.value)} />
            {issuesByPath.get('dates.range.startDate')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
            ))}
          </div>
          <div>
            <label className={labelCls}>{tEvents('dates.end')}</label>
            <input type="date" className={inputCls} value={rangeEnd}
              onChange={(e) => onRangeEndChange(e.target.value)} />
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
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
        <p className={sectionCls}>{tEvents('registrationWindow.label')}</p>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{tEvents('registrationWindow.opensAt')}</label>
            <input type="date" className={inputCls} value={regOpensAt}
              onChange={(e) => onRegOpensAtChange(e.target.value)} />
            {regOpensError && (
              <p className="mt-1 text-[12px] text-[var(--color-danger)]">{regOpensError}</p>
            )}
            {issuesByPath.get('registrationWindow.opensAt')?.map((msg, i) => (
              <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
            ))}
          </div>
          <div>
            <label className={labelCls}>
              {tEvents('registrationWindow.closesAt')}
              <span className="ml-1 text-[11px] font-normal text-[var(--color-text-muted)]">
                {!regClosesAt && minWeighinDay
                  ? `— ${tEvents('registrationWindow.closesAtAuto', { date: minWeighinDay })}`
                  : '(optional)'}
              </span>
            </label>
            <input type="date" className={inputCls} value={regClosesAt}
              onChange={(e) => onRegClosesAtChange(e.target.value)} />
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
