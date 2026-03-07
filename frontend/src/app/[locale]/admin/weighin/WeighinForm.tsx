'use client';

import { useState, useEffect, useMemo } from 'react';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { WeighInDecision } from '@/types/api';

const INPUT =
  'h-10 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/30';

const DECISIONS: { key: WeighInDecision; bg: string }[] = [
  { key: 'PASS', bg: 'bg-[var(--color-success)]' },
  { key: 'REWEIGH', bg: 'bg-[var(--color-warning)]' },
  { key: 'FAIL', bg: 'bg-[var(--color-danger)]' },
  { key: 'ONE_HOUR', bg: 'bg-amber-600' },
];
const D_CLR: Record<string, string> = {
  PASS: 'text-[var(--color-success)]',
  REWEIGH: 'text-[var(--color-warning)]',
  FAIL: 'text-[var(--color-danger)]',
  ONE_HOUR: 'text-amber-400',
};

type WEntry = {
  id: string; attemptNo: number; weightKg: number; decision: string;
  deadlineAt?: string | null; resolvedAt?: string | null; resolvedAction?: string | null;
};
type WCatInfo = {
  id: string;
  rulesetWeightCategory: { name: string; minWeightKgExcl: number | null; maxWeightKgIncl: number | null };
  eventAgeGroup: {
    weightCategories: Array<{ id: string; rulesetWeightCategory: { sortOrder: number; name: string; maxWeightKgIncl: number | null } }>;
  };
} | null;

type SelectedReg = {
  id: string; categoryLabel: string | null;
  athlete: { id: string; firstName: string; lastName: string; documentId: string | null };
  club: { name: string } | null; weighIns: WEntry[];
  eventWeightCategory: WCatInfo;
};

function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    function update() {
      const diff = new Date(deadlineAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('EXPIRED'); return; }
      const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, '0')}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadlineAt]);
  const expired = remaining === 'EXPIRED';
  return (
    <span className={`text-[12px] font-mono font-bold ${expired ? 'text-[var(--color-danger)]' : 'text-amber-400'}`}>
      {remaining}
    </span>
  );
}

interface Props {
  selected: SelectedReg;
  isPending: boolean;
  isResolvePending: boolean;
  t: (key: string) => string;
  tC: (key: string) => string;
  onRecord: (weight: string, decision: WeighInDecision, override: boolean, overrideReason: string) => void;
  onMoveUp: (attemptId: string, nextEventWeightCategoryId: string) => void;
  onDQ: (attemptId: string) => void;
}

export function WeighinForm({ selected, isPending, isResolvePending, t, tC, onRecord, onMoveUp, onDQ }: Props) {
  const [weight, setWeight] = useState('');
  const [decision, setDecision] = useState<WeighInDecision>('PASS');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [resolveAttemptId, setResolveAttemptId] = useState<string | null>(null);
  const [moveUpCategoryId, setMoveUpCategoryId] = useState('');

  const cat = selected.eventWeightCategory;
  const maxWeight = cat?.rulesetWeightCategory?.maxWeightKgIncl ?? null;
  const minWeight = cat?.rulesetWeightCategory?.minWeightKgExcl ?? null;
  const weightNum = parseFloat(weight);

  // Auto-determine suggestion based on measured weight vs category limits
  const suggestion = useMemo<WeighInDecision | null>(() => {
    if (!weight || isNaN(weightNum) || !cat) return null;
    const withinLimits =
      (maxWeight === null || weightNum <= maxWeight) &&
      (minWeight === null || weightNum > minWeight);
    return withinLimits ? 'PASS' : 'FAIL';
  }, [weight, weightNum, cat, maxWeight, minWeight]);

  // Next higher category for move-up
  const nextCategories = useMemo(() => {
    if (!cat) return [];
    const currentSortOrder = cat.rulesetWeightCategory.maxWeightKgIncl ?? Infinity;
    const all = cat.eventAgeGroup.weightCategories;
    return all.filter(
      (wc) => wc.rulesetWeightCategory.maxWeightKgIncl === null || wc.rulesetWeightCategory.maxWeightKgIncl > currentSortOrder,
    );
  }, [cat]);

  return (
    <div className="w-full shrink-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:w-80">
      <p className="text-lg font-semibold text-[var(--color-text)]">
        {selected.athlete.firstName} {selected.athlete.lastName}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          {selected.categoryLabel ?? '—'} · {selected.club?.name ?? '—'}
        </p>
        {maxWeight !== null && (
          <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
            ≤ {maxWeight}kg
          </span>
        )}
      </div>

      <label className="mt-4 block text-[13px] font-medium text-[var(--color-text-muted)]">{t('weight')}</label>
      <div className="relative mt-1">
        <input
          type="number" step="0.1" placeholder="0.0"
          className={`h-14 w-full rounded-[var(--radius-input)] border px-3 text-2xl font-bold text-[var(--color-text)] outline-none focus:ring-2 ${
            suggestion === 'PASS'
              ? 'border-[var(--color-success)] bg-[var(--color-success)]/5 focus:border-[var(--color-success)] focus:ring-[var(--color-success)]/20'
              : suggestion === 'FAIL'
              ? 'border-[var(--color-danger)] bg-[var(--color-danger)]/5 focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/30'
          }`}
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            if (suggestion && !override) setDecision(suggestion);
          }}
        />
        {suggestion && (
          <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold ${
            suggestion === 'PASS' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}>
            {suggestion === 'PASS' ? '✓' : '✗'} {suggestion}
          </span>
        )}
      </div>
      {maxWeight !== null && weight && !isNaN(weightNum) && (
        <p className={`mt-1 text-[12px] font-medium ${weightNum <= maxWeight ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
          {weightNum <= maxWeight
            ? `Within limit (${(maxWeight - weightNum).toFixed(1)}kg under)`
            : `Over limit by ${(weightNum - maxWeight).toFixed(1)}kg`
          }
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-[13px] font-medium text-[var(--color-text-muted)]">{t('decision')}</legend>
        <div className="mt-2 flex gap-2">
          {DECISIONS.map((d) => (
            <label key={d.key} className={`flex flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-input)] py-2.5 text-[13px] font-semibold text-white transition ${d.bg} ${decision === d.key ? 'ring-2 ring-white/40' : 'opacity-50'}`}>
              <input type="radio" name="decision" value={d.key} checked={decision === d.key}
                onChange={() => setDecision(d.key)} className="sr-only" />
              {t(d.key.toLowerCase() as Parameters<typeof t>[0])}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4">
        <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
          {t('override')}
        </label>
        {override && (
          <textarea className="mt-2 w-full rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            placeholder={t('overrideReason')} rows={2} value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)} />
        )}
      </div>

      <PrimaryButton className="mt-4 w-full" disabled={isPending || !weight}
        onClick={() => onRecord(weight, decision, override, overrideReason)}>
        {isPending ? tC('loading') : t('record')}
      </PrimaryButton>

      {selected.weighIns.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="mb-2 text-[12px] font-medium text-[var(--color-text-muted)]">{t('attempts')}</p>
          <div className="space-y-2">
            {selected.weighIns.map((a) => (
              <div key={a.id}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--color-text)]">#{a.attemptNo} — {a.weightKg}kg</span>
                  <span className={D_CLR[a.decision] ?? 'text-[var(--color-text-muted)]'}>{a.decision}</span>
                </div>
                {a.decision === 'ONE_HOUR' && a.deadlineAt && !a.resolvedAt && (
                  <div className="mt-1 rounded border border-amber-600/30 bg-amber-900/20 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--color-text-muted)]">{t('deadline')}</span>
                      <Countdown deadlineAt={a.deadlineAt} />
                    </div>
                    {resolveAttemptId === a.id ? (
                      <div className="mt-2 space-y-2">
                        {nextCategories.length > 0 ? (
                          <select
                            className={INPUT + ' text-[12px]'}
                            value={moveUpCategoryId}
                            onChange={(e) => setMoveUpCategoryId(e.target.value)}
                          >
                            <option value="">Select next category…</option>
                            {nextCategories.map((nc) => (
                              <option key={nc.id} value={nc.id}>
                                {nc.rulesetWeightCategory.name}
                                {nc.rulesetWeightCategory.maxWeightKgIncl !== null ? ` (≤ ${nc.rulesetWeightCategory.maxWeightKgIncl}kg)` : ''}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-[11px] text-[var(--color-danger)]">No higher category available for this event.</p>
                        )}
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveUpCategoryId && onMoveUp(a.id, moveUpCategoryId)}
                            disabled={!moveUpCategoryId || isResolvePending || nextCategories.length === 0}
                            className="flex-1 rounded bg-[var(--color-success)] py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                          >
                            {t('moveUp')}
                          </button>
                          <button onClick={() => onDQ(a.id)} disabled={isResolvePending}
                            className="flex-1 rounded bg-[var(--color-danger)] py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                            {t('dq')}
                          </button>
                          <button onClick={() => setResolveAttemptId(null)}
                            className="rounded px-2 py-1.5 text-[11px] text-[var(--color-text-muted)]">
                            {tC('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setResolveAttemptId(a.id)}
                        className="mt-1 text-[11px] font-medium text-amber-400 underline">
                        {t('resolve')}
                      </button>
                    )}
                  </div>
                )}
                {a.decision === 'ONE_HOUR' && a.resolvedAt && (
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                    {t('resolvedAs')} {a.resolvedAction}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
