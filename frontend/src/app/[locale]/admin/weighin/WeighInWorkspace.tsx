'use client';

import type { MutableRefObject } from 'react';
import { AdminErrorAlert } from '@/components/admin/AdminErrorAlert';
import { EventPhaseGate } from '@/components/admin/EventPhaseGate';
import { WeighInAthleteList } from '@/features/weighin/components/WeighInAthleteList';
import { WeighInDetailsPanel } from '@/features/weighin/components/WeighInDetailsPanel';
import { WeighInMobilePanelHeader } from '@/features/weighin/components/WeighInMobilePanelHeader';
import { WeighInOverrideDialog } from '@/features/weighin/components/WeighInOverrideDialog';
import { WeighInQueueSummary } from '@/features/weighin/components/WeighInQueueSummary';
import type { EventControlGateState } from '@/domain/events/controlPageGate';
import type { WeighInQueueGroup } from '@/lib/weighin/queue';
import type {
  WeighInCategory,
  WeighInDecision,
  WeighInListEntry,
  WeighInPreviewResponse,
} from '@/types/weighin';

type Props = {
  currentEventId: string;
  gate: EventControlGateState;
  showContent: boolean;
  locale: string;
  eventsError: unknown;
  onRetryEvents: () => void;
  athletesError: unknown;
  onRetryAthletes: () => void;
  lifecycleSteps: Array<{ key: string; label: string; stage: string }>;
  lifecycleIndex: number;
  stats: { total: number; passed: number; pending: number; moved: number; failed: number };
  groupedQueue: Array<WeighInQueueGroup & { headingLabel: string }>;
  resolvedSelectedRegistrationId: string | null;
  athletesLoading: boolean;
  selectedAthleteName: string;
  selectedEntry: WeighInListEntry | null;
  preview: WeighInPreviewResponse | null;
  previewError: unknown;
  previewLoading: boolean;
  weightInput: string;
  recordError: unknown;
  isRecordPending: boolean;
  isReconcilingCategory: boolean;
  overrideOpen: boolean;
  categories: WeighInCategory[];
  queueSectionRef: MutableRefObject<HTMLElement | null>;
  panelSectionRef: MutableRefObject<HTMLElement | null>;
  mobileView: 'queue' | 'panel';
  onSelectAthlete: (id: string) => void;
  onWeightInputChange: (value: string) => void;
  onRecord: (payload: {
    decision?: WeighInDecision;
    reason?: string;
    nextEventWeightCategoryId?: string;
    override?: boolean;
  }) => void;
  onReconcileCategory: () => void;
  onOpenOverride: () => void;
  onBackToQueue: () => void;
  onCloseOverride: () => void;
  t: (key: string, values?: Record<string, unknown>) => string;
  tC: (key: string) => string;
  tGate: (key: string, values?: Record<string, unknown>) => string;
  tEvents: (key: string) => string;
};

export function WeighInWorkspace({
  currentEventId,
  gate,
  showContent,
  locale,
  eventsError,
  onRetryEvents,
  athletesError,
  onRetryAthletes,
  lifecycleSteps,
  lifecycleIndex,
  stats,
  groupedQueue,
  resolvedSelectedRegistrationId,
  athletesLoading,
  selectedAthleteName,
  selectedEntry,
  preview,
  previewError,
  previewLoading,
  weightInput,
  recordError,
  isRecordPending,
  isReconcilingCategory,
  overrideOpen,
  categories,
  queueSectionRef,
  panelSectionRef,
  mobileView,
  onSelectAthlete,
  onWeightInputChange,
  onRecord,
  onReconcileCategory,
  onOpenOverride,
  onBackToQueue,
  onCloseOverride,
  t,
  tC,
  tGate,
  tEvents,
}: Props) {
  return (
    <>
      {currentEventId && gate.mode !== 'active' ? (
        <EventPhaseGate
          gate={gate}
          locale={locale}
          t={tGate}
          tEvents={tEvents}
        />
      ) : null}

      {showContent ? (
        <WeighInQueueSummary
          lifecycleSteps={lifecycleSteps}
          lifecycleIndex={lifecycleIndex}
          stats={stats}
          t={t}
        />
      ) : null}

      {eventsError ? (
        <AdminErrorAlert
          error={eventsError}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={onRetryEvents}
        />
      ) : null}
      {showContent && athletesError ? (
        <AdminErrorAlert
          error={athletesError}
          fallbackMessage={tC('loadError')}
          retryLabel={tC('retry')}
          onRetry={onRetryAthletes}
        />
      ) : null}

      {showContent ? (
        <div className="relative overflow-hidden md:grid md:grid-cols-[minmax(300px,40%)_minmax(0,60%)] md:items-start md:gap-4">
          <section
            ref={queueSectionRef}
            className={`min-w-0 space-y-3 transition-transform duration-[250ms] ease-out md:relative md:translate-x-0 md:opacity-100 md:pointer-events-auto ${
              mobileView === 'queue'
                ? 'relative translate-x-0 opacity-100 pointer-events-auto'
                : 'absolute inset-0 -translate-x-full opacity-0 pointer-events-none'
            }`}
          >
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('queueTitle')}
            </h2>
            <WeighInAthleteList
              groups={groupedQueue}
              selectedId={resolvedSelectedRegistrationId}
              isLoading={athletesLoading}
              onSelect={onSelectAthlete}
              t={t}
            />
          </section>

          <section
            ref={panelSectionRef}
            className={`space-y-3 border-0 transition-transform duration-[250ms] ease-out md:relative md:translate-x-0 md:opacity-100 md:pointer-events-auto md:sticky md:top-[calc(var(--topbar-height)+2rem)] md:self-start md:max-h-[calc(100vh-var(--topbar-height)-3rem)] md:overflow-y-auto md:border-l md:border-[var(--color-border)] md:pl-4 ${
              mobileView === 'panel'
                ? 'relative translate-x-0 opacity-100 pointer-events-auto'
                : 'absolute inset-0 translate-x-full opacity-0 pointer-events-none'
            }`}
          >
            <WeighInMobilePanelHeader
              backLabel={tC('back')}
              queueLabel={t('queueTitle')}
              selectedAthleteName={selectedAthleteName}
              onBack={onBackToQueue}
            />
            <h2 className="hidden text-[13px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] md:block">
              {t('detailsTitle')}
            </h2>
            <WeighInDetailsPanel
              selected={selectedEntry}
              preview={preview}
              previewError={previewError}
              previewLoading={previewLoading}
              weightInput={weightInput}
              recordError={recordError}
              isRecordPending={isRecordPending}
              onWeightInputChange={onWeightInputChange}
              onRecord={onRecord}
              isReconcilingCategory={isReconcilingCategory}
              onReconcileCategory={onReconcileCategory}
              onOpenOverride={onOpenOverride}
              isOverrideOpen={overrideOpen}
              t={t}
              tC={tC}
            />
          </section>
        </div>
      ) : null}

      {overrideOpen ? (
        <WeighInOverrideDialog
          open={overrideOpen}
          categories={categories}
          isPending={isRecordPending}
          onClose={onCloseOverride}
          onSubmit={(payload) =>
            onRecord({
              ...payload,
              override: true,
            })
          }
          t={t}
        />
      ) : null}
    </>
  );
}
