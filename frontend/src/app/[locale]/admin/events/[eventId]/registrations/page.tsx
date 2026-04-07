import { RegistrationsPageClient } from '@/app/[locale]/admin/registrations/RegistrationsPageClient';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventRegistrationsPage({ params }: Props) {
  const { eventId } = await params;

  return <RegistrationsPageClient eventId={eventId} />;
}
