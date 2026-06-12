'use client';

import Link from 'next/link';
import { getAdminEventPath } from '@/features/admin-events/lib/adminEventRoutes';

type Props = {
  currentEventId: string;
  locale: string;
  pathname: string;
  tNav: (key: string) => string;
  tPublic: (key: string) => string;
};

// Bottom navigation for the mobile Weigh-In Results view. (The old generate /
// regenerate action bar moved to the Brackets page.)
export function DrawMobileBottomBars({
  currentEventId,
  locale,
  pathname,
  tNav,
  tPublic,
}: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 md:hidden">
      <ul className="grid grid-cols-5 gap-1 text-center">
        {[
          { href: `/${locale}/admin`, label: tPublic('overview') },
          { href: getAdminEventPath(locale, currentEventId, 'weighin'), label: tNav('weighin') },
          { href: getAdminEventPath(locale, currentEventId, 'draw'), label: tNav('draw') },
          { href: getAdminEventPath(locale, currentEventId, 'brackets'), label: tNav('brackets') },
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
  );
}
