'use client';

import { useState } from 'react';
import type { DrawAthletePoolRow } from '@/types/api';

type Props = {
  eligible: DrawAthletePoolRow[];
  excluded: DrawAthletePoolRow[];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
};

function AthleteTable({
  rows,
  t,
  excluded,
}: {
  rows: DrawAthletePoolRow[];
  excluded?: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
      <table className="min-w-full text-[12px]">
        <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
          <tr>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.name')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.club')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.original')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.final')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.weighIn')}</th>
            <th className="px-2 py-2 text-left font-medium">{t('athleteColumns.flags')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.registrationId} className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
              <td className="px-2 py-2 text-[var(--color-text)]">
                <p>{row.athleteName}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{row.athleteCode}</p>
              </td>
              <td className="px-2 py-2 text-[var(--color-text)]">{row.clubName ?? '—'}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">{row.originalCategory ?? '—'}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">{row.finalCategory ?? '—'}</td>
              <td className="px-2 py-2 text-[var(--color-text)]">{t(`weighInStatus.${row.weighInStatus}`)}</td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-1">
                  {row.movedUp && (
                    <span className="rounded-[var(--radius-pill)] border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-300">
                      {t('badgeMovedUp')}
                    </span>
                  )}
                  {row.overrideUsed && (
                    <span className="rounded-[var(--radius-pill)] border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                      {t('badgeOverride')}
                    </span>
                  )}
                  {excluded && row.exclusionReasonCode && (
                    <span className="rounded-[var(--radius-pill)] border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-300">
                      {t(`issueCode.${row.exclusionReasonCode}`)}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-2 py-3 text-[var(--color-text-muted)]">
                {excluded ? t('emptyExcludedAthletes') : t('emptyEligibleAthletes')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function BracketAthleteList({ eligible, excluded, t }: Props) {
  const [tab, setTab] = useState<'eligible' | 'excluded'>('eligible');

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          type="button"
          className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[12px] ${
            tab === 'eligible'
              ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
          onClick={() => setTab('eligible')}
        >
          {t('eligibleAthletesTab', { count: eligible.length })}
        </button>
        <button
          type="button"
          className={`rounded-[calc(var(--radius-input)-2px)] px-3 py-1.5 text-[12px] ${
            tab === 'excluded'
              ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]'
              : 'text-[var(--color-text-muted)]'
          }`}
          onClick={() => setTab('excluded')}
        >
          {t('excludedAthletesTab', { count: excluded.length })}
        </button>
      </div>

      {tab === 'eligible' ? (
        <AthleteTable rows={eligible} t={t} />
      ) : (
        <AthleteTable rows={excluded} t={t} excluded />
      )}
    </div>
  );
}
