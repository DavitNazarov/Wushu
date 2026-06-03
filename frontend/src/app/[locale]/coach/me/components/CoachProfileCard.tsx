'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { LogoutButton } from '@/components/layout/LogoutButton';
import { publicVariants } from '@/lib/animations/variants';
import type { AuthContext } from '../me.types';

type Props = { auth: AuthContext };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <motion.div variants={publicVariants.staggerItem}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <p className="mt-1 text-[15px]">{value}</p>
    </motion.div>
  );
}

export function CoachProfileCard({ auth }: Props) {
  const t = useTranslations('coach.me');

  return (
    <Card className="space-y-4">
      <Field label={t('name')} value={auth.displayName ?? '—'} />
      <Field label={t('role')} value="Coach" />
      <Field label={t('club')} value={auth.clubName ?? '—'} />
      <Field label={t('organisation')} value={auth.organisationName ?? '—'} />
      <motion.div variants={publicVariants.staggerItem} className="pt-4">
        <LogoutButton />
      </motion.div>
    </Card>
  );
}
