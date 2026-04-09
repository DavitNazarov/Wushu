'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';

export default function AboutPage() {
  const tPublic = useTranslations('public');

  return (
    <PublicLayout>
      <div className="space-y-12 py-8">
        <div className="relative aspect-[1200/400] w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
           <Image
            src="/images/hero-action.svg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>

        <h1 className="text-3xl font-bold text-[var(--color-text)]">{tPublic('aboutTitle')}</h1>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">{tPublic('aboutMission')}</h2>
          <p className="text-[var(--color-text-muted)]">{tPublic('aboutMissionText')}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">{tPublic('aboutWhatItDoes')}</h2>
          <p className="text-[var(--color-text-muted)]">{tPublic('aboutWhatItDoesText')}</p>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">{tPublic('aboutContact')}</h2>
          <p className="text-[var(--color-text-muted)]">{tPublic('aboutContactText')}</p>
        </section>
      </div>
    </PublicLayout>
  );
}
