import { AdminLivePageClient } from '@/app/[locale]/admin/live/AdminLivePageClient';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventLivePage({ params }: Props) {
  const { eventId } = await params;

  return <AdminLivePageClient eventId={eventId} />;
}
