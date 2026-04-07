'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import { TopbarToggles } from '@/components/layout/TopbarToggles';

type Props = {
  children: ReactNode;
};

export function LoginShell({ children }: Props) {
  const tApp = useTranslations('app');
  const tAuth = useTranslations('auth');
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const subtitle = tApp('subtitle');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-4 px-6 py-4">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-[var(--color-text)] hover:opacity-90"
          >
            <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </span>
            {subtitle ? <span className="text-sm font-medium">{subtitle}</span> : null}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/events`}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {tPublic('viewEvents')}
            </Link>
            <TopbarToggles />
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4">
        <Card className="w-full max-w-sm p-6">
          <div className="mb-6 space-y-2 text-center">
            <div className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-surface-alt)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {tApp('badge')}
            </div>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">{tApp('title')}</h1>
            <p className="text-[13px] text-[var(--color-text-muted)]">{tAuth('subtitle')}</p>
          </div>
          {children}
        </Card>
      </div>
    </div>
  );
}
