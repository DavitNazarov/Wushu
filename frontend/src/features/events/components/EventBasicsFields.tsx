'use client';

import { useTranslations } from 'next-intl';

type Props = {
  name: string;
  nameKa: string;
  slug: string;
  location: string;
  /** Digits-only string; empty = no fee. */
  entryFee: string;
  timezone: string;
  accessType: 'OPEN' | 'CLOSED' | '';
  slugIsValid: boolean;
  issuesByPath: Map<string, string[]>;
  /** 1 = single column (default), 2 = pair related fields side by side. */
  columns?: 1 | 2;
  onNameChange: (value: string) => void;
  onNameKaChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onEntryFeeChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onAccessTypeChange: (value: 'OPEN' | 'CLOSED') => void;
};

export function EventBasicsFields({
  name,
  nameKa,
  slug,
  location,
  entryFee,
  timezone,
  accessType,
  slugIsValid,
  issuesByPath,
  columns = 1,
  onNameChange,
  onNameKaChange,
  onSlugChange,
  onLocationChange,
  onEntryFeeChange,
  onTimezoneChange,
  onAccessTypeChange,
}: Props) {
  const tEvents = useTranslations('admin.events');
  const inputClassName =
    'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
  const labelClassName =
    'mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]';
  const pairClassName = columns === 2 ? 'grid items-start gap-4 sm:grid-cols-2' : 'space-y-4';

  return (
    <div className="space-y-4">
      <div className={pairClassName}>
        <div>
          <label className={labelClassName}>{tEvents('form.nameLabel')}</label>
          <input
            className={inputClassName}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </div>

        <div>
          <label className={labelClassName}>{tEvents('form.nameKaLabel')}</label>
          <input
            className={inputClassName}
            value={nameKa}
            onChange={(event) => onNameKaChange(event.target.value)}
            placeholder={tEvents('form.nameKaPlaceholder')}
          />
        </div>
      </div>

      <div>
        <label className={labelClassName}>{tEvents('form.slugLabel')}</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px] text-[var(--color-text-muted)]">
            /
          </span>
          <input
            className={`${inputClassName} pl-6`}
            value={slug}
            onChange={(event) => onSlugChange(event.target.value)}
            placeholder={tEvents('form.slugPlaceholder')}
          />
        </div>
        {!slugIsValid ? (
          <p className="mt-1 text-[12px] text-[var(--color-danger)]">
            {tEvents('form.slugHint')}
          </p>
        ) : null}
        {issuesByPath.get('slug')?.map((message, index) => (
          <p key={index} className="mt-1 text-[12px] text-[var(--color-danger)]">
            {message}
          </p>
        ))}
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClassName}>{tEvents('form.locationLabel')}</label>
          <input
            className={inputClassName}
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClassName}>{tEvents('form.timezoneLabel')}</label>
          <input
            className={inputClassName}
            value={timezone}
            onChange={(event) => onTimezoneChange(event.target.value)}
          />
        </div>
      </div>

      <div className={pairClassName}>
        <div>
          <label className={labelClassName}>
            {tEvents('form.entryFeeLabel')}
            <span className="ml-1 font-normal text-[var(--color-text-muted)]">
              {tEvents('form.optional')}
            </span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px] text-[var(--color-text-muted)]">
              ₾
            </span>
            <input
              className={`${inputClassName} pl-7`}
              value={entryFee}
              inputMode="numeric"
              placeholder={tEvents('form.entryFeePlaceholder')}
              // Numbers only — strip everything but digits as the user types.
              onChange={(event) => onEntryFeeChange(event.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClassName}>
          {tEvents('form.accessTypeLabel')}
        </label>
        <select
          className={`${inputClassName} cursor-pointer`}
          value={accessType}
          onChange={(e) => {
            if (e.target.value === 'OPEN' || e.target.value === 'CLOSED') {
              onAccessTypeChange(e.target.value);
            }
          }}
        >
          <option value="" disabled>{tEvents('form.accessTypePlaceholder')}</option>
          <option value="OPEN">{tEvents('form.accessTypeOpen')}</option>
          <option value="CLOSED">{tEvents('form.accessTypeClosed')}</option>
        </select>
        {accessType === 'OPEN' && (
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{tEvents('form.accessTypeOpenDesc')}</p>
        )}
        {accessType === 'CLOSED' && (
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{tEvents('form.accessTypeClosedDesc')}</p>
        )}
      </div>
    </div>
  );
}
