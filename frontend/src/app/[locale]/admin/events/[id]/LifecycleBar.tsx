'use client';

import { useTranslations } from 'next-intl';
import type { EventLifecycle } from '@/types/api';

const STAGES: EventLifecycle[] = [
  'REG_OPEN', 'WEIGHIN', 'LOCKED', 'DRAWN', 'PUBLISHED', 'LIVE', 'COMPLETED',
];

interface Props { current: EventLifecycle }

export function LifecycleBar({ current }: Props) {
  const tEvents = useTranslations('admin.events');
  const currentIdx = STAGES.indexOf(current);
  const pct = (currentIdx / (STAGES.length - 1)) * 100;

  return (
    <div className="relative flex w-full items-start justify-between">
      {/* Gray background track */}
      <div className="absolute inset-x-0 top-[4px] h-px bg-[var(--color-border)]" />
      {/* Emerald progress track */}
      {currentIdx > 0 && (
        <div
          className="absolute left-0 top-[4px] h-px bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      )}
      {STAGES.map((stage, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={stage} className="relative z-10 flex flex-col items-center">
            <div className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
              active
                ? 'scale-125 border-[var(--color-primary)] bg-[var(--color-primary)]'
                : done
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
            }`} />
            <span className={`mt-1.5 w-12 text-center text-[10px] font-medium leading-tight sm:w-16 ${
              active ? 'text-[var(--color-primary)]'
              : done ? 'text-emerald-400'
              : 'text-[var(--color-text-muted)]'
            }`}>
              {tEvents(`lifecycleShort.${stage}` as Parameters<typeof tEvents>[0])}
            </span>
          </div>
        );
      })}
    </div>
  );
}
