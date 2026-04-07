import { SchedulePageClient } from '@/app/[locale]/admin/schedule/SchedulePageClient';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventSchedulePage({ params }: Props) {
  const { eventId } = await params;

  return <SchedulePageClient eventId={eventId} />;
}
