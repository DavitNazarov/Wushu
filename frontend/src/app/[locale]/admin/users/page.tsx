import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EmptyState } from '@/components/ui/EmptyState';

export default function UsersPage() {
  const tAdmin = useTranslations('admin');
  const locale = useLocale();

  return (
    <AppShell title={tAdmin('users.title')}>
      <div className="space-y-6">
        <SectionHeader
          title={tAdmin('users.title')}
          action={
            <Link href={`/${locale}/admin/users`}>
              <PrimaryButton>{tAdmin('users.new')}</PrimaryButton>
            </Link>
          }
        />
        <EmptyState
          title={tAdmin('users.emptyTitle')}
          description={tAdmin('users.emptyDescription')}
          action={
            <Link href={`/${locale}/admin/users`}>
              <PrimaryButton>{tAdmin('users.new')}</PrimaryButton>
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}
