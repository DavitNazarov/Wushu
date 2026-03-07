'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SecondaryButton } from '@/components/ui/SecondaryButton';

export default function ContentPage() {
  const t = useTranslations('content');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />
      <InlineAlert variant="info">
        This page has moved. Use the News page to manage content.
      </InlineAlert>
      <Link href={`/${locale}/admin/news`}>
        <SecondaryButton>{tCommon('goToEvents')}</SecondaryButton>
      </Link>
    </div>
  );
}
