'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { TopbarToggles } from './TopbarToggles';

type PublicLayoutProps = {
  children: ReactNode;
};

export function PublicLayout({ children }: PublicLayoutProps) {
  const tApp = useTranslations('app');
  const tPublic = useTranslations('public');
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-[var(--color-text)] hover:opacity-90"
          >
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </span>
            <span className="text-sm font-medium">{tApp('subtitle')}</span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href={`/${locale}/about`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('about')}
            </Link>
            <Link
              href={`/${locale}/clubs`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('clubs')}
            </Link>
            <Link
              href={`/${locale}/rules`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('rules')}
            </Link>
            <Link
              href={`/${locale}/news`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('news')}
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('contact')}
            </Link>
            <Link
              href={`/${locale}/events`}
              className="text-sm font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
            >
              {tPublic('viewEvents')}
            </Link>
            <Link
              href={`/${locale}/login`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('adminSignIn')}
            </Link>
            <TopbarToggles />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-6 py-8">{children}</main>
    </div>
  );
}
