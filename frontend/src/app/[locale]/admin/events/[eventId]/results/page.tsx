import { ResultsPageClient } from '@/app/[locale]/admin/results/ResultsPageClient';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventResultsPage({ params }: Props) {
  const { eventId } = await params;

  return <ResultsPageClient eventId={eventId} />;
}
