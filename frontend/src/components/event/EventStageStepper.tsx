'use client';

import type { EventLifecycle } from '@/types/api';

export const STEPPER_STAGES: EventLifecycle[] = [
  'REG_OPEN',
  'WEIGHIN',
  'LOCKED',
  'DRAWN',
  'PUBLISHED',
  'LIVE',
  'COMPLETED',
];

interface Props {
  /** Current stage from the API — single source of truth. */
  stage: EventLifecycle;
  /** i18n labels keyed by lifecycle value. */
  labels: Record<EventLifecycle, string>;
  /** Render shorter labels (e.g. when space is tight). */
  compact?: boolean;
}

export function EventStageStepper({ stage, labels, compact = false }: Props) {
  const n = STEPPER_STAGES.length; // 7
  const activeIndex = Math.max(0, STEPPER_STAGES.indexOf(stage));

  // The rail runs from the center of the first dot to the center of the last dot.
  // Each step column is 1/n of total width, so the first/last dot centers are at
  // 1/(2n) from each edge.
  const edgePct = `${(100 / (2 * n)).toFixed(4)}%`;

  // How far the green segment fills the rail (0 → 1 fraction of rail length).
  const greenFraction = n > 1 ? activeIndex / (n - 1) : 0;

  return (
    // overflow-x-auto + min-w so dots never collapse on very small viewports.
    <div className="w-full overflow-x-auto" role="list" aria-label="Event stage progress">
      <div className="relative min-w-[400px] pb-1">

        {/* ── Rail (absolute, sits behind dots) ── */}
        <div
          className="pointer-events-none absolute h-[4px]"
          style={{ top: '11px', left: edgePct, right: edgePct }}
        >
          {/* Base track */}
          <div className="absolute inset-0 rounded-full bg-[var(--color-border)]" />
          {/* Completed (green) overlay */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-success)]"
            style={{
              width: `${(greenFraction * 100).toFixed(4)}%`,
              transition: 'width 300ms ease-out',
            }}
          />
        </div>

        {/* ── Steps ── */}
        <div className="relative flex items-start" role="presentation">
          {STEPPER_STAGES.map((s, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive    = idx === activeIndex;
            const isUpcoming  = idx > activeIndex;

            return (
              <div
                key={s}
                role="listitem"
                aria-current={isActive ? 'step' : undefined}
                title={labels[s]}
                className="flex flex-1 flex-col items-center"
              >
                {/* ── Dot zone (26 × 26 hit area keeps ring and dot centered) ── */}
                <div className="relative flex h-[26px] w-[26px] items-center justify-center">

                  {/* Active pulse ring */}
                  {isActive && (
                    <span
                      className="animate-stage-pulse absolute inset-0 rounded-full bg-[var(--color-primary)]"
                      aria-hidden="true"
                    />
                  )}

                  {/* Dot */}
                  <span
                    className={[
                      'relative z-10 rounded-full transition-all duration-150',
                      isCompleted ? 'h-[12px] w-[12px] bg-[var(--color-success)]'        : '',
                      isActive    ? 'h-[14px] w-[14px] bg-[var(--color-primary)]'        : '',
                      isUpcoming  ? 'h-[12px] w-[12px] border-2 border-[var(--color-border)] bg-transparent' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </div>

                {/* ── Label ── */}
                <span
                  className={[
                    'mt-[10px] max-w-[64px] break-words text-center leading-tight',
                    compact ? 'text-[10px]' : 'text-[11px] sm:text-[12px]',
                    isCompleted ? 'font-medium text-[var(--color-success)] opacity-80'  : '',
                    isActive    ? 'font-semibold text-[var(--color-text)]'               : '',
                    isUpcoming  ? 'font-normal text-[var(--color-text-muted)]'           : '',
                  ].join(' ')}
                >
                  {labels[s]}
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
