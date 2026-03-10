'use client';

export function UserDetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-[12px] text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 text-[13px] text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
