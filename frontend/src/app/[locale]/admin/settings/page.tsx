'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiGet } from '@/lib/api/client';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

interface MeResponse {
  userId: string;
  organisationId: string;
  organisationName: string | null;
  role: string;
  displayName: string | null;
  capabilities: string[];
  clubId: string | null;
  clubName: string | null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--color-border)] last:border-0">
      <span className="w-40 shrink-0 text-[13px] text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[13px] text-[var(--color-text)] font-medium">{value || '—'}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="px-5 py-3 bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
        <h2 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations('admin.settings');
  const locale = useLocale();

  const { data: me, error, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<MeResponse>('/api/auth/me'),
  });

  const quickLinks: { label: string; href: string }[] = [
    { label: t('linkUsers'), href: `/${locale}/admin/users` },
    { label: t('linkRulesets'), href: `/${locale}/admin/rulesets` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage="Failed to load account settings."
          retryLabel="Retry"
          onRetry={() => refetch()}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title={t('sectionOrganisation')}>
          <InfoRow label={t('fieldOrgName')} value={me?.organisationName} />
          <InfoRow label={t('fieldOrgId')} value={me?.organisationId} />
        </SectionCard>

        <SectionCard title={t('sectionProfile')}>
          <InfoRow label={t('fieldDisplayName')} value={me?.displayName} />
          <InfoRow label={t('fieldRole')} value={me?.role} />
          {me?.clubName && <InfoRow label={t('fieldClub')} value={me.clubName} />}
        </SectionCard>

        <SectionCard title={t('sectionCapabilities')}>
          {me?.capabilities && me.capabilities.length > 0 ? (
            <div className="py-3 flex flex-wrap gap-2">
              {me.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 text-[11px] font-mono text-[var(--color-text-muted)]"
                >
                  {cap}
                </span>
              ))}
            </div>
          ) : (
            <p className="py-3 text-[13px] text-[var(--color-text-muted)]">—</p>
          )}
        </SectionCard>

        <SectionCard title={t('sectionQuickLinks')}>
          <div className="py-2 space-y-1">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 rounded px-2 py-2 text-[13px] text-[var(--color-primary)] hover:bg-[var(--color-surface-alt)] transition"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
