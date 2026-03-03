import { useTranslations } from 'next-intl';
import { AppShell } from '@/components/layout/AppShell';

export default function SettingsPage() {
  const tAdmin = useTranslations('admin');

  return (
    <AppShell title={tAdmin('settings.title')}>
      <div className="space-y-6">
        <p className="text-[15px] text-[var(--color-text-muted)]">
          {tAdmin('settings.emptyDescription')}
        </p>
      </div>
    </AppShell>
  );
}
