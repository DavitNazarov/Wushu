'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      className="flex w-fit shrink-0 gap-1 rounded-[var(--radius-pill)] border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-1"
      role="group"
      aria-label="Language"
    >
      <Link
        href={pathname || '/'}
        locale="en"
        className={`
          rounded-[var(--radius-pill)] px-4 py-2 text-[14px] font-semibold
          transition-colors duration-150 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1
          ${
            locale === 'en'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)]'
          }
        `}
      >
        EN
      </Link>
      <Link
        href={pathname || '/'}
        locale="ka"
        className={`
          rounded-[var(--radius-pill)] px-4 py-2 text-[14px] font-semibold
          transition-colors duration-150 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1
          ${
            locale === 'ka'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text)] hover:bg-[var(--color-primary-subtle)]'
          }
        `}
      >
        ქართ
      </Link>
    </div>
  );
}
