import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

export default async function NoAccessPage() {
  const tNoAccess = await getTranslations('noAccess');
  const locale = await getLocale();

  return (
    <PublicLayout>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          {tNoAccess('title')}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)]">
          {tNoAccess('description')}
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <Link href={`/${locale}`}>
            <PrimaryButton>{tNoAccess('goHome')}</PrimaryButton>
          </Link>
          <Link
            href={`/${locale}/login?force=1`}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]"
          >
            {tNoAccess('signInDifferent')}
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
