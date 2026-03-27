import { getTranslations } from 'next-intl/server';
import { PublicResultsPanel } from '@/components/event/PublicResultsPanel';
import { PublicLayout } from '@/components/layout/PublicLayout';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicEventResultsPage({ params }: Props) {
  const tPublic = await getTranslations('public');
  const { slug } = await params;
  void slug;

  return (
    <PublicLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {tPublic('results')}
        </h1>
        <PublicResultsPanel eventSlug={slug} />
      </div>
    </PublicLayout>
  );
}
