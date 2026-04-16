import { redirect } from 'next/navigation';
import { getAuthContext, getAuthRedirectUrl } from '@/services/permissions';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardRedirectPage({ params }: Props) {
  const { locale } = await params;
  const auth = await getAuthContext();

  if (!auth.userId || !auth.role) {
    redirect(getAuthRedirectUrl(auth, locale, `/${locale}/dashboard`));
  }

  if (auth.role === 'admin') redirect(`/${locale}/admin`);
  if (auth.role === 'coach') redirect(`/${locale}/coach`);
  if (auth.role === 'athlete') redirect(`/${locale}/athlete`);
  if (auth.role === 'judge' || auth.role === 'timekeeper') {
    redirect(`/${locale}/admin/live`);
  }

  redirect(`/${locale}/admin`);
}
