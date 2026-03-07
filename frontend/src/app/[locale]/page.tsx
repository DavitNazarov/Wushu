'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuthRole } from '@/hooks/useAuthRole';

export default function PublicHomePage() {
  const tPublic = useTranslations('public');
  const locale = useLocale();
  const { role, isLoading } = useAuthRole();

  const heroAuthHref =
    role === 'admin'
      ? `/${locale}/admin`
      : role === 'coach'
        ? `/${locale}/coach`
        : role === 'athlete'
          ? `/${locale}/athlete`
          : `/${locale}/login`;

  const heroAuthLabel =
    role === 'admin'
      ? tPublic('adminDashboard')
      : role === 'coach'
        ? tPublic('coachDashboard')
        : role === 'athlete'
          ? tPublic('athleteProfile')
          : tPublic('adminSignIn');

  return (
    <PublicLayout>
      <div className="space-y-16 py-8">
        <section className="flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)] md:text-5xl">
            {tPublic('heroTitle')}
          </h1>
          <p className="mt-6 max-w-[540px] text-lg text-[var(--color-text-muted)]">
            {tPublic('heroSubtitle')}
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link href={`/${locale}/events`}>
              <PrimaryButton>{tPublic('viewEvents')}</PrimaryButton>
            </Link>
            <Link
              href={heroAuthHref}
              className={`text-sm font-medium hover:opacity-90 ${
                role ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {isLoading ? tPublic('adminSignIn') : heroAuthLabel}
            </Link>
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--color-text)]">{tPublic('featureLiveSchedule')}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{tPublic('featureLiveScheduleDesc')}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--color-text)]">{tPublic('featureBracketsResults')}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{tPublic('featureBracketsResultsDesc')}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[var(--color-text)]">{tPublic('featureFastOps')}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{tPublic('featureFastOpsDesc')}</p>
          </div>
        </section>

        <section>
          <h2 className="mb-8 text-center text-xl font-semibold text-[var(--color-text)]">
            {tPublic('howItWorksTitle')}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">1</span>
              <span className="font-medium text-[var(--color-text)]">{tPublic('howItWorksStep1')}</span>
            </div>
            <span className="hidden text-[var(--color-text-muted)] sm:inline">→</span>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">2</span>
              <span className="font-medium text-[var(--color-text)]">{tPublic('howItWorksStep2')}</span>
            </div>
            <span className="hidden text-[var(--color-text-muted)] sm:inline">→</span>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">3</span>
              <span className="font-medium text-[var(--color-text)]">{tPublic('howItWorksStep3')}</span>
            </div>
            <span className="hidden text-[var(--color-text-muted)] sm:inline">→</span>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">4</span>
              <span className="font-medium text-[var(--color-text)]">{tPublic('howItWorksStep4')}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="relative aspect-[400/280] w-full">
              <Image
                src="/images/hero-action.svg"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="relative aspect-[400/200] w-full">
              <Image
                src="/images/tournament-desk.svg"
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
