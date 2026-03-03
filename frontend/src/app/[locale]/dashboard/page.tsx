import { redirect } from 'next/navigation';
import { getAuthContext } from '@/services/permissions';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardRedirectPage({ params }: Props) {
  const { locale } = await params;
  const auth = await getAuthContext();

  if (!auth.userId || !auth.role) {
    redirect(`/${locale}/login`);
  }

  if (auth.role === 'admin') redirect(`/${locale}/admin`);
  if (auth.role === 'coach') redirect(`/${locale}/coach`);
  if (auth.role === 'athlete') redirect(`/${locale}/athlete`);

  redirect(`/${locale}/admin`);
}
