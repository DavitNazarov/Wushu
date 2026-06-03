'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { publicVariants } from '@/lib/animations/variants';
import { useCoachAuth } from './hooks/useCoachAuth';
import { NoClubScreen } from './components/NoClubScreen';
import { CoachProfileCard } from './components/CoachProfileCard';

export default function CoachMePage() {
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('coach.me');
  const { auth, loading } = useCoachAuth(locale);

  if (loading || !auth) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (auth.role === 'coach' && !auth.clubId) {
    return <NoClubScreen />;
  }

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
        <CoachProfileCard auth={auth} />
      </motion.div>
    </motion.div>
  );
}
