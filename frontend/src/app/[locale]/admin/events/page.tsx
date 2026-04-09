'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { apiGet, apiDelete } from '@/lib/api/client';
import { getCompactErrorMessage } from '@/lib/api/error';
import { adminVariants } from '@/lib/animations/variants';
import { CreateEventModal } from '@/features/events/components/CreateEventModal';
import type { EventRow } from '@/types/api';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';

export default function EventsPage() {
  const tEvents = useTranslations('admin.events');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const locale = useLocale();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiDelete(`/api/events/${pendingDelete.id}`);
      setPendingDelete(null);
      await refetch();
    } catch (error) {
      setDeleteError(getCompactErrorMessage(error, tCommon('error')));
    } finally {
      setDeleting(false);
    }
  }

  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<EventRow[]>('/api/events'),
  });

  const { published: publishedEvents, unpublished: unpublishedEvents } = useMemo(() => {
    if (!events) return { published: [], unpublished: [] };
    const q = search.trim().toLowerCase();
    const base = q
      ? events.filter(
          (e) => e.name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q),
        )
      : events;
    return {
      published: base.filter((e) => e.published),
      unpublished: base.filter((e) => !e.published),
    };
  }, [events, search]);

  const filtered = [...publishedEvents, ...unpublishedEvents];

  return (
    <div className="space-y-6">
      <PageHeader
        title={tEvents('title')}
        actions={
          <PrimaryButton onClick={() => setCreateOpen(true)}>
            {tEvents('new')}
          </PrimaryButton>
        }
      />

      {error && (
        <AdminErrorAlert
          error={error}
          fallbackMessage={tCommon('loadError')}
          retryLabel={tCommon('retry')}
          onRetry={() => refetch()}
        />
      )}

      <motion.div
        initial="initial"
        animate="animate"
        variants={adminVariants.slideDown}
      >
        <input
          type="text"
          placeholder={tCommon('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full max-w-xs rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30"
        />
      </motion.div>

      {isLoading ? (
        <SkeletonRows rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <EmptyState title={tEvents('emptyTitle')} description={tEvents('emptyDescription')} />
      ) : (
        <motion.div
          className="space-y-8"
          variants={adminVariants.staggerContainer}
          initial="initial"
          animate="animate"
        >
          {[
            { label: tEvents('sectionPublished'), rows: publishedEvents },
            { label: tEvents('sectionUnpublished'), rows: unpublishedEvents },
          ].map(({ label, rows }) =>
            rows.length === 0 ? null : (
              <motion.section
                key={label}
                variants={adminVariants.staggerChild}
              >
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {label}
                </h2>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:block">
                  <table className="min-w-full text-[13px]">
                    <thead>
                      <tr className="bg-[var(--color-surface-alt)]">
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.name')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.dates')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.location')}</th>
                        <th className="px-4 py-3 text-left font-medium text-[var(--color-text-muted)]">{tEvents('columns.lifecycle')}</th>
                        <th className="w-10 px-2 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {rows.map((ev) => (
                        <motion.tr
                          key={ev.id}
                          onClick={() => router.push(`/${locale}/admin/events/${ev.id}`)}
                          className="group cursor-pointer bg-[var(--color-surface)] transition hover:bg-[var(--color-surface-alt)]"
                          variants={adminVariants.staggerChild}
                        >
                          <td className="px-4 py-3 font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{ev.name}</td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {new Date(ev.competitionStartDate).toLocaleDateString()}
                            {ev.competitionEndDate && ev.competitionEndDate !== ev.competitionStartDate &&
                              ` – ${new Date(ev.competitionEndDate).toLocaleDateString()}`}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">{ev.location || '—'}</td>
                          <td className="px-4 py-3">
                            <StatusChip
                              status={ev.lifecycle}
                              label={tEvents(`lifecycle.${ev.lifecycle}` as Parameters<typeof tEvents>[0])}
                              domain="lifecycle"
                            />
                          </td>
                          <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={tEvents('delete.button')}
                                onClick={() => { setPendingDelete(ev); setDeleteError(null); }}
                                className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                              </button>
                              <span className="translate-x-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)] group-hover:opacity-100">→</span>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile stacked cards */}
                <div className="space-y-2 sm:hidden">
                  {rows.map((ev) => (
                    <motion.div
                      key={ev.id}
                      className="group relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-surface-alt)]"
                      variants={adminVariants.staggerChild}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/${locale}/admin/events/${ev.id}`)}
                        className="block w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2 pr-8">
                          <p className="truncate text-[13px] font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)]">{ev.name}</p>
                          <StatusChip
                            status={ev.lifecycle}
                            label={tEvents(`lifecycle.${ev.lifecycle}` as Parameters<typeof tEvents>[0])}
                            domain="lifecycle"
                          />
                        </div>
                        <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                          {ev.location || '—'} · {new Date(ev.competitionStartDate).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label={tEvents('delete.button')}
                        onClick={() => { setPendingDelete(ev); setDeleteError(null); }}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-muted)] transition hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            ),
          )}
        </motion.div>
      )}

      <Modal
        open={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        title={tEvents('delete.title')}
        description={pendingDelete?.name}
        footer={
          <>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-alt)] disabled:opacity-50"
            >
              {tEvents('delete.cancel')}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-[var(--radius-input)] bg-red-600 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? tCommon('loading') : tEvents('delete.confirm')}
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {tEvents('delete.description')}
        </p>
        {deleteError && (
          <p className="mt-3 text-[13px] font-medium text-red-500">{deleteError}</p>
        )}
      </Modal>

      <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
