'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicNews } from '@/hooks/usePublicApi';
import type { PublicNewsItem } from '@/lib/api/public';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function NewsPage() {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const { data: items, isLoading, error, refetch } = usePublicNews();

  return (
    <PublicLayout>
      <div className="space-y-16 pb-16">

        {/* hero */}
        <section className="relative flex flex-col items-center py-16 text-center">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[360px] w-[360px] rounded-full bg-[var(--color-primary)] opacity-[0.06] blur-[90px]" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">Updates</p>
          <h1 className="max-w-[540px] text-[clamp(2rem,5vw,3.2rem)] font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)]">
            {tPublic('newsTitle')}
          </h1>
          <p className="mt-4 max-w-[380px] text-[15px] leading-relaxed text-[var(--color-text-muted)]">
            {tPublic('newsSubtitle')}
          </p>
        </section>

        {/* error */}
        {error && (
          <InlineAlert variant="error" actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">{tCommon('retry')}</button>
          }>
            {tCommon('loadError')}
          </InlineAlert>
        )}

        {/* skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-3">
                <Skeleton width="60%" height="18px" />
                <Skeleton width="30%" height="13px" />
                <Skeleton width="85%" height="13px" />
              </div>
            ))}
          </div>
        )}

        {/* empty */}
        {!isLoading && !error && (!items || items.length === 0) && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] py-24 text-center">
            <p className="text-[15px] font-medium text-[var(--color-text-muted)]">{tPublic('noNewsYet')}</p>
          </div>
        )}

        {/* list */}
        {!isLoading && !error && items && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item: PublicNewsItem, i: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Link href={`/news/${item.slug}`} className="group block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all duration-200 hover:border-[var(--color-primary)]/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {item.event && (
                        <span className="mb-2 inline-block rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
                          {item.event.name}
                        </span>
                      )}
                      <h2 className="text-[16px] font-semibold leading-snug text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">
                        {item.title}
                      </h2>
                      <p className="mt-1.5 text-[12px] text-[var(--color-text-muted)]">
                        {formatDate(item.publishedAt ?? item.createdAt)}
                      </p>
                    </div>
                    <svg className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="mt-3 text-[13px] font-medium text-[var(--color-primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {tPublic('readMore')} →
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </PublicLayout>
  );
}
