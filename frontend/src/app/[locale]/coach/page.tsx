import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { getAuthContext } from '@/services/permissions';
import { CoachDashboardClient } from '@/components/coach/dashboard/CoachDashboardClient';

type Props = { params: Promise<{ locale: string }> };

export default async function CoachDashboardPage({ params }: Props) {
  const { locale } = await params;
  const tNoClub = await getTranslations('coach.noClub');
  const auth = await getAuthContext();

  if (!auth.userId || !auth.organisationId) {
    redirect(`/${locale}/login?next=/${locale}/coach`);
  }

  if (auth.role === 'coach' && !('clubId' in auth ? auth.clubId : null)) {
    return (
      <div className="space-y-6">
        <PageHeader title={tNoClub('title')} />
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">{tNoClub('description')}</p>
        </Card>
      </div>
    );
  }

  return (
    <CoachDashboardClient
      context={{
        clubId: 'clubId' in auth ? auth.clubId ?? null : null,
        clubName: 'clubName' in auth ? auth.clubName ?? null : null,
        displayName: 'displayName' in auth ? auth.displayName ?? null : null,
        organisationName: 'organisationName' in auth ? auth.organisationName ?? null : null,
      }}
    />
  );
}
