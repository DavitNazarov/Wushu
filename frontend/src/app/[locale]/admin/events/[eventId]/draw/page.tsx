import { DrawPageContainer } from '@/app/[locale]/admin/draw/DrawPageContainer';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventDrawPage({ params }: Props) {
  const { eventId } = await params;

  return <DrawPageContainer eventId={eventId} />;
}
