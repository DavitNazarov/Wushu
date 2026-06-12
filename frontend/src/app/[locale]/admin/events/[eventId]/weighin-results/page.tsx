import { DrawPageContainer } from '@/app/[locale]/admin/weighin-results/DrawPageContainer';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventWeighInResultsPage({ params }: Props) {
  const { eventId } = await params;

  return <DrawPageContainer eventId={eventId} />;
}
