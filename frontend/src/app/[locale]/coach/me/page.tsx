'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { LogoutButton } from '@/components/layout/LogoutButton';
import { publicVariants } from '@/lib/animations/variants';
import { apiGet } from '@/lib/api/client';

type AuthContext = {
  userId: string | null;
  organisationId: string | null;
  role: string;
  clubId?: string | null;
  displayName?: string | null;
  clubName?: string | null;
  organisationName?: string | null;
};

export default function CoachMePage() {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('coach.me');
  const tNoClub = useTranslations('coach.noClub');

  const [auth, setAuth] = useState<AuthContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const context = await apiGet<AuthContext>('/api/auth/me');
        setAuth(context);

        if (!context.userId || !context.organisationId) {
          router.push(`/${locale}/login?next=/${locale}/coach/me`);
          return;
        }

        if (context.role === 'coach' && !context.clubId) {
          setAuth(context);
        }
      } catch {
        router.push(`/${locale}/login?next=/${locale}/coach/me`);
      } finally {
        setLoading(false);
      }
    }

    loadAuth();
  }, [router, locale, t, tNoClub]);

  if (loading || !auth) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (auth.role === 'coach' && !auth.clubId) {
    return (
      <motion.div
        className="space-y-6"
        variants={publicVariants.staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={publicVariants.staggerItem}>
          <PageHeader title={tNoClub('title')} />
        </motion.div>
        <motion.div variants={publicVariants.staggerItem}>
          <Card>
            <p className="text-[15px] text-[var(--color-text-muted)]">{tNoClub('description')}</p>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  const displayName = auth.displayName ?? null;
  const clubName = auth.clubName ?? null;
  const organisationName = auth.organisationName ?? null;

  return (
    <motion.div
      className="space-y-6"
      variants={publicVariants.staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={publicVariants.staggerItem}>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
      </motion.div>

      <motion.div variants={publicVariants.staggerItem}>
        <Card className="space-y-4">
          <motion.div variants={publicVariants.staggerItem}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('name')}
            </span>
            <p className="mt-1 text-[15px]">{displayName ?? '—'}</p>
          </motion.div>
          <motion.div variants={publicVariants.staggerItem}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('role')}
            </span>
            <p className="mt-1 text-[15px]">Coach</p>
          </motion.div>
          <motion.div variants={publicVariants.staggerItem}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('club')}
            </span>
            <p className="mt-1 text-[15px]">{clubName ?? '—'}</p>
          </motion.div>
          <motion.div variants={publicVariants.staggerItem}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {t('organisation')}
            </span>
            <p className="mt-1 text-[15px]">{organisationName ?? '—'}</p>
          </motion.div>
          <motion.div variants={publicVariants.staggerItem} className="pt-4">
            <LogoutButton />
          </motion.div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
