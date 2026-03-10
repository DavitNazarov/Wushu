'use client';

import type { BracketFightListRow } from '@/types/api';
import { StatusChip } from '@/components/ui/StatusChip';

type Props = {
  fights: BracketFightListRow[];
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  tFightStatus: (key: string, values?: Record<string, string | number | Date>) => string;
};

type StandingRow = {
  athleteId: string;
  name: string;
  fights: number;
  wins: number;
  losses: number;
  pending: number;
};

function buildStandings(fights: BracketFightListRow[]): StandingRow[] {
  const map = new Map<string, StandingRow>();

  function ensure(id: string, name: string): StandingRow {
    const existing = map.get(id);
    if (existing) return existing;
    const created: StandingRow = {
      athleteId: id,
      name,
      fights: 0,
      wins: 0,
      losses: 0,
      pending: 0,
    };
    map.set(id, created);
    return created;
  }

  for (const fight of fights) {
    const redId = fight.redAthleteId;
    const blueId = fight.blueAthleteId;
    const redName = fight.redAthleteName;
    const blueName = fight.blueAthleteName;
    if (!redId || !blueId || !redName || !blueName) continue;

    const red = ensure(redId, redName);
    const blue = ensure(blueId, blueName);
    red.fights += 1;
    blue.fights += 1;

    if (!fight.winnerAthleteId) {
      red.pending += 1;
      blue.pending += 1;
      continue;
    }
    if (fight.winnerAthleteId === redId) {
      red.wins += 1;
      blue.losses += 1;
    } else if (fight.winnerAthleteId === blueId) {
      blue.wins += 1;
      red.losses += 1;
    } else {
      red.pending += 1;
      blue.pending += 1;
    }
  }

  return [...map.values()].sort((a, b) => {
    const byWins = b.wins - a.wins;
    if (byWins !== 0) return byWins;
    const byPending = a.pending - b.pending;
    if (byPending !== 0) return byPending;
    return a.name.localeCompare(b.name);
  });
}

export function RoundRobinPanel({ fights, tBracket, tFightStatus }: Props) {
  const standings = buildStandings(fights);

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="mb-2 text-[12px] font-semibold text-[var(--color-text)]">
          {tBracket('roundRobinStandingsTitle')}
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="text-[var(--color-text-muted)]">
              <tr>
                <th className="px-2 py-1 text-left font-medium">{tBracket('athleteColumns.name')}</th>
                <th className="px-2 py-1 text-left font-medium">{tBracket('metricFights')}</th>
                <th className="px-2 py-1 text-left font-medium">{tBracket('wins')}</th>
                <th className="px-2 py-1 text-left font-medium">{tBracket('losses')}</th>
                <th className="px-2 py-1 text-left font-medium">{tBracket('pending')}</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.athleteId} className="border-t border-[var(--color-border)]">
                  <td className="px-2 py-1.5 text-[var(--color-text)]">{row.name}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)]">{row.fights}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)]">{row.wins}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)]">{row.losses}</td>
                  <td className="px-2 py-1.5 text-[var(--color-text)]">{row.pending}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-[var(--color-text-muted)]">
                    {tBracket('emptyFights')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)]">
        <table className="min-w-full text-[12px]">
          <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-2 py-2 text-left font-medium">{tBracket('fightColumns.bout')}</th>
              <th className="px-2 py-2 text-left font-medium">{tBracket('fightColumns.red')}</th>
              <th className="px-2 py-2 text-left font-medium">{tBracket('fightColumns.blue')}</th>
              <th className="px-2 py-2 text-left font-medium">{tBracket('fightColumns.status')}</th>
              <th className="px-2 py-2 text-left font-medium">{tBracket('fightColumns.result')}</th>
            </tr>
          </thead>
          <tbody>
            {fights.map((fight) => (
              <tr key={fight.id} className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
                <td className="px-2 py-2 text-[var(--color-text)]">#{fight.boutNo}</td>
                <td className="px-2 py-2 text-[var(--color-text)]">{fight.redAthleteName ?? tBracket('bye')}</td>
                <td className="px-2 py-2 text-[var(--color-text)]">{fight.blueAthleteName ?? tBracket('bye')}</td>
                <td className="px-2 py-2 text-[var(--color-text)]">
                  <StatusChip status={fight.status} label={tFightStatus(fight.status)} domain="fight" />
                </td>
                <td className="px-2 py-2 text-[var(--color-text)]">
                  {fight.score ?? fight.winMethod ?? '—'}
                </td>
              </tr>
            ))}
            {fights.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-[var(--color-text-muted)]">
                  {tBracket('emptyFights')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
