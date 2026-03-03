import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import Link from 'next/link';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';

export default async function CoachDashboardPage() {
  const tPublic = await getTranslations('public');
  const locale = await getLocale();

  return (
    <PublicLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          Coach Dashboard
        </h1>
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">
            Manage your athletes and registrations. This area is under development.
          </p>
          <Link
            href={`/${locale}/events`}
            className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {tPublic('viewEvents')} →
          </Link>
        </Card>
      </div>
    </PublicLayout>
  );
}
