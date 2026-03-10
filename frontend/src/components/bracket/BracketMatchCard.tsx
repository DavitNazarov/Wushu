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
};

export function BracketMatchCard({
  match,
  showConnectorRight,
  showConnectorLeft,
  tFightStatus,
  tBracket,
}: Props) {
  return (
    <article className="relative space-y-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <BracketConnectorLayer showRight={showConnectorRight} showLeft={showConnectorLeft} />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-text-muted)]">#{match.fightNumber}</span>
        <div className="flex items-center gap-1.5">
          <BracketScoreBadge score={match.score} winMethod={match.winMethod} />
          <StatusChip status={match.status as never} label={tFightStatus(match.status)} domain="fight" />
        </div>
      </div>

      <div className="space-y-1.5">
        <BracketParticipantRow slot={match.participants.a} tBracket={tBracket} />
        <BracketParticipantRow slot={match.participants.b} tBracket={tBracket} />
      </div>

      {match.isBye && <BracketByeCard label={tBracket('badgeBye')} />}
    </article>
  );
}
