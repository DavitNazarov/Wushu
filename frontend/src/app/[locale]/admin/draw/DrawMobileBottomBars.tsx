'use client';

import Link from 'next/link';
import { getAdminEventPath } from '@/features/admin-events/lib/adminEventRoutes';
import type { DrawOverviewResponse } from '@/types/api';

type Props = {
  overview: DrawOverviewResponse | null;
  editable: boolean;
  currentEventId: string;
  locale: string;
  pathname: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  tNav: (key: string) => string;
  tPublic: (key: string) => string;
};

export function DrawMobileBottomBars({
  overview,
  editable,
  currentEventId,
  locale,
  pathname,
  onGenerate,
  onRegenerate,
  t,
  tNav,
  tPublic,
}: Props) {
  return (
    <>
      {overview && editable && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] p-2 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {overview.event.drawStatus === 'NOT_GENERATED' ? (
              <button
                type="button"
                onClick={onGenerate}
                className="min-h-[44px] rounded-[var(--radius-input)] bg-[var(--color-primary)] px-3 text-[13px] font-semibold text-white"
              >
                {t('actionGenerate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onRegenerate}
                className="min-h-[44px] rounded-[var(--radius-input)] bg-[var(--color-danger)] px-3 text-[13px] font-semibold text-white"
              >
                {t('actionRegenerate')}
              </button>
            )}
            <Link
              href={getAdminEventPath(locale, currentEventId, 'brackets')}
              className="flex min-h-[44px] items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] px-3 text-[13px] font-semibold text-[var(--color-text)]"
            >
              {t('actionViewBrackets')}
            </Link>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 md:hidden">
        <ul className="grid grid-cols-5 gap-1 text-center">
          {[
            { href: `/${locale}/admin`, label: tPublic('overview') },
            { href: getAdminEventPath(locale, currentEventId, 'weighin'), label: tNav('weighin') },
            { href: getAdminEventPath(locale, currentEventId, 'draw'), label: tNav('draw') },
            { href: getAdminEventPath(locale, currentEventId, 'live'), label: tNav('live') },
            { href: `/${locale}/admin/settings`, label: tPublic('more') },
          ].map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] px-1 text-[12px] font-semibold ${
                    active
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
