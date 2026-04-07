import { BracketsPageContainer } from '@/app/[locale]/admin/brackets/BracketsPageContainer';

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminEventBracketsPage({ params }: Props) {
  const { eventId } = await params;

  return <BracketsPageContainer eventId={eventId} />;
}
