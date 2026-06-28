'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MapPin, Calendar } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicNewsPost } from '@/hooks/usePublicApi';

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function NewsPostPage({ params }: Props) {
  const tPublic = useTranslations('public');
  const tCommon = useTranslations('common');
  const locale  = useLocale();
  const { slug } = use(params);
  const { data: post, isLoading, error, refetch, isSuccess } = usePublicNewsPost(slug);

  // 404 only when the fetch succeeded and the slug genuinely has no post. On a
  // transient error, fall through to the retryable alert below — don't hard-404.
  if (isSuccess && !post) notFound();

  return (
    <PublicLayout>
      <div className="space-y-10 pb-16 pt-6">

        {/* back link */}
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {tCommon('back')}
        </Link>

        {error && (
          <InlineAlert variant="error" actions={
            <button onClick={() => refetch()} className="text-[13px] font-medium underline">{tCommon('retry')}</button>
          }>
            {tCommon('loadError')}
          </InlineAlert>
        )}

        {isLoading && (
          <div className="space-y-5">
            <Skeleton width="65%" height="32px" />
            <Skeleton width="28%" height="14px" />
            <div className="space-y-2 pt-2">
              <Skeleton width="100%" height="15px" />
              <Skeleton width="95%" height="15px" />
              <Skeleton width="88%" height="15px" />
            </div>
          </div>
        )}

        {!isLoading && post && (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* article hero */}
            <div className="relative mb-10 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 md:p-12">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-3xl" />

              {post.event && (
                <span className="mb-4 inline-block rounded-full bg-[var(--color-primary-subtle)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">
                  {post.event.name}
                </span>
              )}
              <h1 className="text-[clamp(1.5rem,4vw,2.4rem)] font-extrabold leading-[1.15] tracking-tight text-[var(--color-text)]">
                {post.title}
              </h1>
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)]">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.publishedAt ?? post.createdAt)}
              </p>
            </div>

            {/* body */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 md:p-10">
              <p className="whitespace-pre-line text-[15px] leading-[1.85] text-[var(--color-text)]">
                {post.body}
              </p>
            </div>

            {/* related event */}
            {post.event && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-6"
              >
                <Link
                  href={`/events/${post.event.slug}`}
                  className="group flex items-center justify-between rounded-2xl border border-[var(--color-primary)]/25 bg-[var(--color-surface)] px-6 py-5 transition-all duration-200 hover:border-[var(--color-primary)]/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)]"
                >
                  <div>
                    <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                      {tPublic('relatedEvent')}
                    </p>
                    <p className="text-[15px] font-semibold text-[var(--color-text)]">{post.event.name}</p>
                    {post.event.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
                        <MapPin className="h-3 w-3" />
                        {post.event.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)]">
                    {tPublic('viewEvent')}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </motion.div>
            )}
          </motion.article>
        )}

      </div>
    </PublicLayout>
  );
}
