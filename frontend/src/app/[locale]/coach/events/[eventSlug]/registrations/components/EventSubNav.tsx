'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { publicVariants } from '@/lib/animations/variants';
import { SUB_NAV } from '../registrations.constants';

type Props = { eventSlug: string; locale: string };

export function EventSubNav({ eventSlug, locale }: Props) {
  const t = useTranslations('coach.registrations');

  return (
    <motion.div className="flex flex-wrap gap-1" variants={publicVariants.staggerItem}>
      {SUB_NAV.map(({ key, href, icon: Icon }) => (
        <Link
          key={key}
          href={href(eventSlug, locale)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
        >
          <Icon className="h-3 w-3" />
          {t(`nav.${key}`)}
        </Link>
      ))}
    </motion.div>
  );
}
