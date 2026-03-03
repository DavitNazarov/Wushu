'use client';

import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';

export default function RulesPage() {
  const tPublic = useTranslations('public');

  return (
    <PublicLayout>
      <div className="space-y-12 py-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{tPublic('rulesTitle')}</h1>
        <p className="text-[var(--color-text-muted)]">{tPublic('rulesIntro')}</p>

        <section>
          <h2 className="mb-6 text-xl font-semibold text-[var(--color-text)]">{tPublic('rulesLifecycleTitle')}</h2>
          <p className="mb-6 text-[var(--color-text-muted)]">{tPublic('rulesLifecycleIntro')}</p>
          <ul className="space-y-4">
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">1.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep1')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">2.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep2')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">3.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep3')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">4.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep4')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">5.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep5')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">6.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep6')}</span>
            </li>
            <li className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <span className="font-semibold text-[var(--color-primary)]">7.</span>
              <span className="text-[var(--color-text)]">{tPublic('rulesStep7')}</span>
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">{tPublic('rulesPublishingTitle')}</h2>
          <p className="text-[var(--color-text-muted)]">{tPublic('rulesPublishingText')}</p>
        </section>
      </div>
    </PublicLayout>
  );
}
