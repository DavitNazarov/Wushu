'use client';

import { StatusChip } from '@/components/ui/StatusChip';
import { BracketScoreBadge } from './BracketScoreBadge';
import { BracketConnectorLayer } from './BracketConnectorLayer';
import { BracketParticipantRow } from './BracketParticipantRow';
import { BracketByeCard } from './BracketByeCard';
import type { BracketRendererMatch } from './types';

type Props = {
  match: BracketRendererMatch;
  showConnectorRight: boolean;
  showConnectorLeft: boolean;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
};

export function BracketMatchCard({
  match,
  showConnectorRight,
  showConnectorLeft,
  tFightStatus,
  tBracket,
  getAthleteHref,
}: Props) {
  return (
    <article className="bracket-bout relative min-h-[168px] space-y-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <BracketConnectorLayer showRight={showConnectorRight} showLeft={showConnectorLeft} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {tBracket('fightColumns.bout')}
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">#{match.fightNumber}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusChip status={match.status as never} label={tFightStatus(match.status)} domain="fight" />
          <BracketScoreBadge score={match.score} winMethod={match.winMethod} />
        </div>
      </div>

      <div className="space-y-2">
        <BracketParticipantRow slot={match.participants.a} tBracket={tBracket} getAthleteHref={getAthleteHref} />
        <BracketParticipantRow slot={match.participants.b} tBracket={tBracket} getAthleteHref={getAthleteHref} />
      </div>

      {match.isBye && <BracketByeCard label={tBracket('badgeBye')} />}
    </article>
  );
}
