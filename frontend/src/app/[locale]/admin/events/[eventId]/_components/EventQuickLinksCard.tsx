'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/primitives/card';
import { getAdminEventPath } from '@/features/admin-events/lib/adminEventRoutes';

const QUICK_LINKS = [
  'registrations',
  'weighin',
  'draw',
  'brackets',
  'schedule',
  'live',
  'results',
] as const;

interface Props {
  eventId: string;
}

export function EventQuickLinksCard({ eventId }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const tDetail = useTranslations('admin.events.detail');
  const tNav = useTranslations('nav');

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
        {tDetail('quickLinksTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_LINKS.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => router.push(getAdminEventPath(locale, eventId, section))}
            className="flex items-center justify-between rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2.5 text-[12px] font-medium text-[var(--color-text)] transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5"
          >
            {section === 'results'
              ? tNav('results')
              : tDetail(`link_${section}` as Parameters<typeof tDetail>[0])}
            <span className="text-[var(--color-text-muted)]">→</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
