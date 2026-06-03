'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { publicVariants } from '@/lib/animations/variants';

export function NoClubScreen() {
  const t = useTranslations('coach.noClub');

  return (
    <motion.div
      className="space-y-6"
      variants={publicVariants.staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={publicVariants.staggerItem}>
        <PageHeader title={t('title')} />
      </motion.div>
      <motion.div variants={publicVariants.staggerItem}>
        <Card>
          <p className="text-[15px] text-[var(--color-text-muted)]">{t('description')}</p>
        </Card>
      </motion.div>
    </motion.div>
  );
}
