'use client';

type Props = {
  name: string;
  slug: string;
  location: string;
  timezone: string;
  slugIsValid: boolean;
  inputCls: string;
  labelCls: string;
  issuesByPath: Map<string, string[]>;
  tEvents: (key: string) => string;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
};

export function EventBasicsFields({
  name,
  slug,
  location,
  timezone,
  slugIsValid,
  inputCls,
  labelCls,
  issuesByPath,
  tEvents,
  onNameChange,
  onSlugChange,
  onLocationChange,
  onTimezoneChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>{tEvents('columns.name')}</label>
        <input className={inputCls} value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Slug</label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-[13px] text-[var(--color-text-muted)]">/</span>
          <input className={`${inputCls} pl-6`} value={slug} onChange={(e) => onSlugChange(e.target.value)} placeholder="tbilisi-open-2026" />
        </div>
        {!slugIsValid ? (
          <p className="mt-1 text-[12px] text-[var(--color-danger)]">
            Lowercase letters, numbers, and dashes only
          </p>
        ) : null}
        {issuesByPath.get('slug')?.map((msg, i) => (
          <p key={i} className="mt-1 text-[12px] text-[var(--color-danger)]">{msg}</p>
        ))}
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{tEvents('columns.location')}</label>
          <input className={inputCls} value={location} onChange={(e) => onLocationChange(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>{tEvents('timezone')}</label>
          <input className={inputCls} value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
