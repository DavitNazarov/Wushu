'use client';

import { BracketRoundColumn } from './BracketRoundColumn';
import { BracketScrollableViewport } from './BracketScrollableViewport';
import type { BracketRendererData } from './types';

type Props = {
  data: BracketRendererData;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  tFightStatus: (key: string) => string;
  getAthleteHref?: (athleteId: string) => string;
};

function labelForRound(input: { label: string; roundNumber: number; t: Props['tBracket'] }): string {
  if (input.label === 'FINAL') return input.t('roundLabel.FINAL');
  if (input.label === 'SEMIFINAL') return input.t('roundLabel.SEMIFINAL');
  if (input.label === 'QUARTERFINAL') return input.t('roundLabel.QUARTERFINAL');
  if (input.label === 'ROUND_ROBIN') return input.t('roundLabel.ROUND_ROBIN');
  return input.t('roundLabel.ROUND', { round: input.roundNumber });
}

export function BracketRenderer({ data, tBracket, tFightStatus, getAthleteHref }: Props) {
  if (data.rounds.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-alt)] p-6 text-[13px] text-[var(--color-text-muted)]">
        {tBracket('emptyBracketViewer')}
      </div>
    );
  }

  return (
    <BracketScrollableViewport>
      {data.rounds.map((round, index) => (
        <BracketRoundColumn
          key={round.id}
          round={round}
          roundIndex={index}
          title={labelForRound({ label: round.label, roundNumber: round.roundNumber, t: tBracket })}
          isFirst={index === 0}
          isLast={index === data.rounds.length - 1}
          tFightStatus={tFightStatus}
          tBracket={tBracket}
          getAthleteHref={getAthleteHref}
        />
      ))}
    </BracketScrollableViewport>
  );
}
