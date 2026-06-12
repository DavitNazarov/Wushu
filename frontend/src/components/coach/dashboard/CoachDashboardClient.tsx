'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SkeletonKpiRow, SkeletonRows } from '@/components/ui/Skeleton';
import { publicVariants } from '@/lib/animations/variants';
import { CoachPrimaryAction } from './CoachPrimaryAction';
import { CoachDashboardPendingActions } from './CoachDashboardPendingActions';
import { CoachDashboardRecentUpdates } from './CoachDashboardRecentUpdates';
import { CoachDashboardSidebar } from './CoachDashboardSidebar';
import { CoachDashboardSummaryCards } from './CoachDashboardSummaryCards';
import { CoachDashboardUpcomingEvents } from './CoachDashboardUpcomingEvents';
import type { CoachDashboardContext } from './types';
import { useCoachDashboardData } from './useCoachDashboardData';

type Props = {
  context: CoachDashboardContext;
};

export function CoachDashboardClient({ context }: Props) {
  const t = useTranslations('coach.dashboard');
  const tCommon = useTranslations('common');
  const { athletesQuery, eventsQuery, registrationErrors, isLoading, isBaseLoading, model } = useCoachDashboardData();

  const baseError = athletesQuery.error ?? eventsQuery.error;

  return (
    <motion.div
      className="space-y-6"
      variants={publicVariants.staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={publicVariants.staggerItem}>
        <PageHeader
          title={context.displayName ? t('greeting', { name: context.displayName }) : t('title')}
          subtitle={t('greetingSubtitle')}
        />
      </motion.div>

      {baseError && (
        <motion.div variants={publicVariants.staggerItem}>
          <InlineAlert variant="error">
            {tCommon('loadError')}
          </InlineAlert>
        </motion.div>
      )}

      {registrationErrors > 0 && !baseError && (
        <motion.div variants={publicVariants.staggerItem}>
          <InlineAlert variant="warning">{t('partialRegistrationsWarning')}</InlineAlert>
        </motion.div>
      )}

      {isBaseLoading || isLoading || !model ? (
        <div className="space-y-6">
          <SkeletonKpiRow count={4} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
            <div className="space-y-6">
              <SkeletonRows rows={4} cols={2} />
              <SkeletonRows rows={4} cols={3} />
            </div>
            <SkeletonRows rows={4} cols={1} />
          </div>
        </div>
      ) : (
        <>
          <motion.div variants={publicVariants.staggerItem}>
            <CoachPrimaryAction events={model.upcomingEvents} totalAthletes={model.summary.totalAthletes} />
          </motion.div>

          {!(model.summary.totalAthletes === 0 && model.upcomingEvents.length === 0) && (
            <>
              <motion.div variants={publicVariants.staggerItem}>
                <CoachDashboardSummaryCards summary={model.summary} />
              </motion.div>

              <motion.div
                className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]"
                variants={publicVariants.staggerItem}
              >
                <div className="space-y-6">
                  <CoachDashboardPendingActions actions={model.pendingActions} />
                  <CoachDashboardUpcomingEvents events={model.upcomingEvents} />
                  <CoachDashboardRecentUpdates
                    updates={model.recentUpdates}
                    hasExactTimestamps={model.hasExactUpdateTimestamps}
                  />
                </div>
                <CoachDashboardSidebar
                  context={context}
                  athleteCount={model.summary.totalAthletes}
                  quickActions={model.quickActions}
                />
              </motion.div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
