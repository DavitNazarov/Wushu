'use client';

import { useTranslations } from 'next-intl';

type Props = {
  name: string;
  nameKa: string;
  slug: string;
  location: string;
  timezone: string;
  slugIsValid: boolean;
  issuesByPath: Map<string, string[]>;
  onNameChange: (value: string) => void;
  onNameKaChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
};

export function EventBasicsFields({
  name,
  nameKa,
  slug,
  location,
  timezone,
  slugIsValid,
  issuesByPath,
  onNameChange,
  onNameKaChange,
  onSlugChange,
  onLocationChange,
  onTimezoneChange,
}: Props) {
  const tEvents = useTranslations('admin.events');
  const inputClassName =
    'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';
  const labelClassName =
    'mb-1 block text-[12px] font-medium text-[var(--color-text-muted)]';

  return (
    <div className="space-y-4">
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

      <div className="grid items-end gap-3 sm:grid-cols-2">
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
    </div>
  );
}
