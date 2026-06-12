'use client';

import { Check } from 'lucide-react';

type StepStatus = 'complete' | 'current' | 'upcoming' | 'error';

export interface StepperStep {
  /** Stable identifier for the step. */
  id: string;
  /** Short label shown under the dot. */
  label: string;
  /** Optional one-word hint shown under the label on larger screens. */
  hint?: string;
  status: StepStatus;
  /** When true the step cannot be clicked (not yet reachable). */
  disabled?: boolean;
}

interface StepperProps {
  steps: StepperStep[];
  /** Fires only for enabled (reachable) steps. */
  onStepClick?: (id: string, index: number) => void;
  className?: string;
}

/**
 * Reusable horizontal step indicator. Purely presentational — the parent owns
 * step state and computes each step's status / reachability. Colours come from
 * CSS variables so it themes with light/dark automatically.
 */
export function Stepper({ steps, onStepClick, className }: StepperProps) {
  return (
    <ol
      role="list"
      aria-label="Progress"
      className={['flex w-full items-start overflow-x-auto px-1 py-2', className ?? ''].join(' ')}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const clickable = Boolean(onStepClick) && !step.disabled;
        const connectorFilled = step.status === 'complete';

        return (
          <li
            key={step.id}
            className="relative flex min-w-[72px] flex-1 flex-col items-center"
            aria-current={step.status === 'current' ? 'step' : undefined}
          >
            {/* Connector: from this dot's centre to the next dot's centre. */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[17px] h-[2px] w-full"
              >
                <span className="absolute inset-0 rounded-full bg-[var(--color-border)]" />
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-primary)] transition-[width] duration-300 ease-out"
                  style={{ width: connectorFilled ? '100%' : '0%' }}
                />
              </span>
            ) : null}

            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick?.(step.id, index) : undefined}
              className={[
                'group relative z-10 flex flex-col items-center gap-2 px-2',
                clickable ? 'cursor-pointer' : 'cursor-default',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-semibold transition-all duration-200',
                  step.status === 'complete'
                    ? 'border-transparent bg-[var(--color-primary)] text-white'
                    : '',
                  step.status === 'current'
                    ? 'border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/15'
                    : '',
                  step.status === 'upcoming'
                    ? 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    : '',
                  step.status === 'error'
                    ? 'border-[var(--color-danger)] bg-[var(--color-surface)] text-[var(--color-danger)] ring-4 ring-[var(--color-danger)]/15'
                    : '',
                  clickable && step.status === 'upcoming'
                    ? 'group-hover:border-[var(--color-primary)] group-hover:text-[var(--color-primary)]'
                    : '',
                ].join(' ')}
              >
                {step.status === 'complete' ? (
                  <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>

              <span className="flex max-w-[120px] flex-col items-center text-center">
                <span
                  className={[
                    'text-[12px] font-medium leading-tight transition-colors',
                    step.status === 'error'
                      ? 'text-[var(--color-danger)]'
                      : step.status === 'upcoming'
                        ? 'text-[var(--color-text-muted)]'
                        : 'text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {step.label}
                </span>
                {step.hint ? (
                  <span className="mt-0.5 hidden text-[11px] text-[var(--color-text-muted)] sm:block">
                    {step.hint}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
