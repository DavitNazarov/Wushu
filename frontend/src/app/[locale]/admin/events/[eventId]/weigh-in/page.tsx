import { WeighInPageContainer } from '@/app/[locale]/admin/weighin/WeighInPageContainer';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventWeighInPage({ params }: Props) {
  const { eventId } = await params;

  return <WeighInPageContainer eventId={eventId} />;
}
