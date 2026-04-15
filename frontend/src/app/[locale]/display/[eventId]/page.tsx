import { DisplayPageClient } from './DisplayPageClient';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function DisplayPage({ params }: Props) {
  const { eventId } = await params;

  return <DisplayPageClient eventId={eventId} />;
}
