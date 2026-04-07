import { redirect } from 'next/navigation';
import { getLegacyAdminEventRedirectTarget } from '@/features/admin-events/lib/legacyAdminEventRedirect';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyAdminSchedulePage({ params, searchParams }: Props) {
  const { locale } = await params;
  redirect(
    getLegacyAdminEventRedirectTarget({
      locale,
      page: 'schedule',
      searchParams: await searchParams,
    }),
  );
}
