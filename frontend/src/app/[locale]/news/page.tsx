import { getTranslations } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Card } from '@/components/ui/Card';
import { getApiUrl } from '@/lib/api';

type NewsRow = { id: string; title: string; body: string };

export default async function NewsPage() {
  const tPublic = await getTranslations('public');

  const res = await fetch(getApiUrl('/api/public/news'), { cache: 'no-store' });
  const items: NewsRow[] = res.ok ? await res.json() : [];
  const hasItems = items.length > 0;

  return (
    <PublicLayout>
      <div className="space-y-6 py-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            {tPublic('newsTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            {tPublic('newsSubtitle')}
          </p>
        </div>

        {!hasItems && (
          <Card>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {tPublic('noNewsYet')}
            </p>
          </Card>
        )}

        {hasItems && (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id}>
                <h2 className="text-[15px] font-semibold text-[var(--color-text)]">
                  {item.title}
                </h2>
                <p className="mt-2 whitespace-pre-line text-[13px] text-[var(--color-text-muted)]">
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}


