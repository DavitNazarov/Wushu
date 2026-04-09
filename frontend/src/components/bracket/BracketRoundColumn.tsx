'use client';

import { BracketMatchCard } from './BracketMatchCard';
import { BracketRoundHeader } from './BracketRoundHeader';
import type { BracketRendererRound } from './types';

/**
 * SLOT_BASE: the height (px) of one match slot in round 0 (first round).
 * For round R, slot height = SLOT_BASE * 2^R.
 * This ensures each later-round match is vertically centered between the
 * two earlier-round matches that feed into it — forming a proper bracket tree.
 */
const SLOT_BASE = 100;

/**
 * ARM: horizontal arm length (px) extending from a match card into the gap
 * between columns. Must be ≤ half the gap (gap-5 = 20px → max ARM = 10).
 */
const ARM = 10;

type Props = {
  round: BracketRendererRound;
  roundIndex: number;
  title: string;
  isFirst: boolean;
  isLast: boolean;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
};

export function BracketRoundColumn({
  round,
  roundIndex,
  title,
  isFirst,
  isLast,
  tFightStatus,
  tBracket,
  getAthleteHref,
}: Props) {
  const slotH = SLOT_BASE * Math.pow(2, roundIndex);

  return (
    <section
      className={`bracket-round w-[240px] shrink-0 ${
        isFirst ? 'bracket-round--first' : ''
      } ${isLast ? 'bracket-round--last' : ''}`}
    >
      <BracketRoundHeader round={round} title={title} />

      <div className="bracket-round-matches mt-2 flex flex-col">
        {round.matches.map((match) => (
          <div key={match.id} style={{ height: slotH }} className="relative">
            {/* ── Left connectors (rounds after the first) ─────────────────
                Vertical bar runs from 25 % → 75 % of this slot, meeting
                the midpoints of the two child slots that feed this match.
                Horizontal arm bridges the gap from the vertical bar to
                the left edge of the match card.
            ──────────────────────────────────────────────────────────── */}
            {!isFirst && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bg-[var(--color-border)]"
                  style={{ left: -ARM, top: '25%', bottom: '25%', width: 1 }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute bg-[var(--color-border)]"
                  style={{ left: -ARM, top: 'calc(50% - 0.5px)', width: ARM, height: 1 }}
                />
              </>
            )}

            {/* ── Match card — absolutely centered in its slot ─────────── */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              <BracketMatchCard
                match={match}
                tFightStatus={tFightStatus}
                tBracket={tBracket}
                getAthleteHref={getAthleteHref}
              />
            </div>

            {/* ── Right arm (rounds before the last) ───────────────────── */}
            {!isLast && (
              <span
                aria-hidden
                className="pointer-events-none absolute bg-[var(--color-border)]"
                style={{ right: -ARM, top: 'calc(50% - 0.5px)', width: ARM, height: 1 }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
