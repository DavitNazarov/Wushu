'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/Skeleton';
import { publicVariants } from '@/lib/animations/variants';
import { localizedName } from '@/lib/bilingual';
import type { EventRow } from '@/types/api';

type Props = {
  event: EventRow | undefined;
  eventSlug: string;
  locale: string;
  eventLoading: boolean;
  regStatus: string | null;
  isRegOpen: boolean;
  hasEventId: boolean;
  onAdd: () => void;
};

export function RegistrationsHeader({ event, eventSlug, locale, eventLoading, regStatus, isRegOpen, hasEventId, onAdd }: Props) {
  const t = useTranslations('coach.registrations');

  return (
    <motion.div variants={publicVariants.staggerItem}>
      {eventLoading ? (
        <div className="space-y-2">
          <Skeleton width="50%" height="28px" />
          <Skeleton width="30%" height="16px" />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">
              {event ? localizedName(event.name, event.nameKa, locale) : eventSlug}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-[var(--color-text-muted)]">{t('title')}</p>
              {event && regStatus && (
                <span className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  regStatus === 'OPEN'
                    ? 'bg-[var(--color-success-subtle)] text-[var(--color-success)]'
                    : regStatus === 'UPCOMING'
                      ? 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                }`}>
                  {t(`regStatus.${regStatus}`)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onAdd}
            disabled={!hasEventId || !isRegOpen}
            title={!isRegOpen ? t('regStatusClosed') : undefined}
            className="shrink-0 h-9 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {t('addRegistration')}
          </button>
        </div>
      )}
    </motion.div>
  );
}
