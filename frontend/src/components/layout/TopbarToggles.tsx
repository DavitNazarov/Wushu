'use client';

import { Sun, Moon } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { Link, usePathname } from '@/i18n/navigation';

export function TopbarToggles() {
  const tAdmin = useTranslations('admin');
  const { theme, toggleTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-0.5">
        <Link
          href={pathname || '/'}
          locale="en"
          className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition-colors ${
            locale === 'en'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          EN
        </Link>
        <Link
          href={pathname || '/'}
          locale="ka"
          className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition-colors ${
            locale === 'ka'
              ? 'bg-[var(--color-primary)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          KA
        </Link>
      </div>

      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
        title={theme === 'dark' ? tAdmin('theme.light') : tAdmin('theme.dark')}
        aria-label={theme === 'dark' ? tAdmin('theme.light') : tAdmin('theme.dark')}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Moon className="h-4 w-4" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
