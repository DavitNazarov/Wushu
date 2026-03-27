'use client';

import { Link } from '@/i18n/navigation';

type Props = {
  athleteId: string;
  label: string;
  className?: string;
};

export function PublicAthleteNameLink({
  athleteId,
  label,
  className,
}: Props) {
  return (
    <Link
      href={`/athletes/${athleteId}`}
      className={`underline-offset-4 decoration-[var(--color-primary)]/55 transition hover:text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] ${className ?? ''}`}
    >
      {label}
    </Link>
  );
}
