'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `
      flex h-7 items-center rounded-[var(--radius-pill)] px-2 text-xs font-semibold
      transition-colors duration-150 ease-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1
      ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-primary-subtle)] hover:text-[var(--color-text)]'
      }
    `;

  return (
    <div
      className="flex h-9 w-fit shrink-0 items-center gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
      role="group"
      aria-label="Language"
    >
      <Link href={pathname || '/'} locale="en" className={linkClass(locale === 'en')}>
        EN
      </Link>
      <Link href={pathname || '/'} locale="ka" className={linkClass(locale === 'ka')}>
        ქართ
      </Link>
    </div>
  );
}
