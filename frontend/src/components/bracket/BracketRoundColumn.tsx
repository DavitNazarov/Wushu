'use client';

import { BracketMatchCard } from './BracketMatchCard';
import { BracketRoundHeader } from './BracketRoundHeader';
import type { BracketRendererRound } from './types';

type Props = {
  round: BracketRendererRound;
  title: string;
  isFirst: boolean;
  isLast: boolean;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
};

export function BracketRoundColumn({
  round,
  title,
  isFirst,
  isLast,
  tFightStatus,
  tBracket,
}: Props) {
  return (
    <section className="w-[308px] shrink-0 space-y-3">
      <BracketRoundHeader round={round} title={title} />
      <div className="space-y-3">
        {round.matches.map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            showConnectorLeft={!isFirst}
            showConnectorRight={!isLast}
            tFightStatus={tFightStatus}
            tBracket={tBracket}
          />
        ))}
      </div>
    </section>
  );
}
