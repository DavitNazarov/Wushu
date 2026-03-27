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
  getAthleteHref?: (athleteId: string) => string;
};

export function BracketRoundColumn({
  round,
  title,
  isFirst,
  isLast,
  tFightStatus,
  tBracket,
  getAthleteHref,
}: Props) {
  return (
    <section
      className={`bracket-round w-[336px] shrink-0 space-y-4 ${
        isFirst ? 'bracket-round--first' : ''
      } ${isLast ? 'bracket-round--last' : ''}`}
    >
      <BracketRoundHeader round={round} title={title} />
      <div className="bracket-round-matches space-y-4">
        {round.matches.map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            showConnectorLeft={!isFirst}
            showConnectorRight={!isLast}
            tFightStatus={tFightStatus}
            tBracket={tBracket}
            getAthleteHref={getAthleteHref}
          />
        ))}
      </div>
    </section>
  );
}
