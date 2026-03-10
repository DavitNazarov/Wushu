import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicEventSchedulePage({ params }: Props) {
  const tPublic = await getTranslations('public');
  const { slug } = await params;
  void slug;

  return (
    <PublicLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {tPublic('schedule')}
        </h1>
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">
            {tPublic('notPublishedDescription')}
          </p>
        </Card>
      </div>
    </PublicLayout>
  );
}
