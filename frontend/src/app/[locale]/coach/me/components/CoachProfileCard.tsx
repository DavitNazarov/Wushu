'use client';

import { type ElementType } from 'react';
import { useTranslations } from 'next-intl';
import { Building, Building2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { LogoutButton } from '@/components/layout/LogoutButton';
import type { AuthContext } from '../me.types';

type Props = { auth: AuthContext };

function initialsFrom(name: string | null | undefined) {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--color-border)] py-4 first:border-t-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-[var(--color-text-muted)]">{label}</p>
        <p className="truncate text-[15px] font-medium text-[var(--color-text)]">{value}</p>
      </div>
    </div>
  );
}

export function CoachProfileCard({ auth }: Props) {
  const t = useTranslations('coach.me');

  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-subtle)] text-[20px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
          {initialsFrom(auth.displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[20px] font-bold text-[var(--color-text)]">{auth.displayName ?? '—'}</p>
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-primary-subtle)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-primary)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t('roleCoach')}
          </span>
        </div>
      </div>

      <div>
        <InfoRow icon={Building} label={t('club')} value={auth.clubName ?? '—'} />
        <InfoRow icon={Building2} label={t('organisation')} value={auth.organisationName ?? '—'} />
      </div>

      <div className="border-t border-[var(--color-border)] pt-5">
        <LogoutButton />
      </div>
    </Card>
  );
}
