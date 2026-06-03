type Props = { initials: string; size?: 'sm' | 'md' | 'lg' };

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[12px]',
  lg: 'h-14 w-14 text-[15px]',
};

export function AthleteAvatar({ initials, size = 'md' }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] font-semibold uppercase text-[var(--color-primary)] ${SIZE[size]}`}
    >
      {initials}
    </div>
  );
}
