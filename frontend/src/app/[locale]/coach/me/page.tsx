import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/services/permissions';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { LogoutButton } from '@/components/layout/LogoutButton';

type Props = { params: Promise<{ locale: string }> };

export default async function CoachMePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('coach.me');
  const tNoClub = await getTranslations('coach.noClub');
  const auth = await getAuthContext();

  if (!auth.userId || !auth.organisationId) {
    redirect(`/${locale}/login?next=/${locale}/coach/me`);
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
  const displayName = 'displayName' in auth ? auth.displayName : null;
  const clubName = 'clubName' in auth ? auth.clubName : null;
  const organisationName = 'organisationName' in auth ? auth.organisationName : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card className="space-y-4">
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('name')}
          </span>
          <p className="mt-1 text-[15px]">{displayName ?? '—'}</p>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('role')}
          </span>
          <p className="mt-1 text-[15px]">Coach</p>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('club')}
          </span>
          <p className="mt-1 text-[15px]">{clubName ?? '—'}</p>
        </div>
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('organisation')}
          </span>
          <p className="mt-1 text-[15px]">{organisationName ?? '—'}</p>
        </div>
        <div className="pt-4">
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
