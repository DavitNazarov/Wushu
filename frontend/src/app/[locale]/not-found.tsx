import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Mail,
  Newspaper,
} from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { Button } from '@/components/ui/primitives/button';
import { GoBackButton } from '@/components/layout/GoBackButton';

// Branded, bilingual 404. Rendered for any unmatched route under [locale]
// (the locale layout above provides the next-intl context, so the public
// header + translations work exactly like a normal page). Returns a real
// HTTP 404, so search engines treat it as noindex without extra metadata.
export default async function NotFound() {
  const [locale, t, tPublic] = await Promise.all([
    getLocale(),
    getTranslations('notFound'),
    getTranslations('public'),
  ]);

  const exploreLinks = [
    { href: `/${locale}/events`, label: tPublic('viewEvents'), Icon: Calendar },
    { href: `/${locale}/news`, label: tPublic('news'), Icon: Newspaper },
    { href: `/${locale}/rules`, label: tPublic('rules'), Icon: BookOpen },
    { href: `/${locale}/contact`, label: tPublic('contact'), Icon: Mail },
  ] as const;

  return (
    <PublicLayout>
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 py-12 text-center">
        {/* Soft brand glow behind the numeral — purely decorative. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[30%] -z-10 h-[420px] w-[420px] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary-subtle)] blur-3xl"
        />

        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]"
          />
          {t('eyebrow')}
        </span>

        <p
          aria-hidden
          className="mt-6 select-none bg-[linear-gradient(180deg,var(--color-text)_0%,var(--color-text-muted)_100%)] bg-clip-text text-[88px] font-extrabold leading-none tracking-tight tabular-nums text-transparent sm:text-[120px] lg:text-[140px]"
        >
          404
        </p>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[var(--color-text)] sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-text-muted)]">
          {t('description')}
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link href={`/${locale}`}>{t('goHome')}</Link>
          </Button>
          <GoBackButton label={t('goBack')} fallbackHref={`/${locale}`} />
        </div>

        {/* Helpful exits — a 404 should always offer a way forward. */}
        <div className="relative mt-14 w-full max-w-lg">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-[var(--color-border)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--color-bg)] px-3 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('exploreLabel')}
            </span>
          </div>
        </div>

        <nav
          aria-label={t('exploreLabel')}
          className="mt-6 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {exploreLinks.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-input)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)]">
                {label}
              </span>
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--color-text)]"
              />
            </Link>
          ))}
        </nav>
      </section>
    </PublicLayout>
  );
}
