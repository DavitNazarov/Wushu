'use client';

import { BracketMatchCard } from './BracketMatchCard';
import { BracketRoundHeader } from './BracketRoundHeader';
import type { BracketRendererRound } from './types';

/**
 * SLOT_BASE: the height (px) of one match slot in round 0 (first round).
 * For round R, slot height = SLOT_BASE * 2^R plus the gaps between child slots.
 * This ensures each later-round match is vertically centered between the
 * two earlier-round matches that feed into it — forming a proper bracket tree.
 */
const SLOT_BASE = 100;

/** Vertical gap between match slots within a column. */
const MATCH_GAP = 30;

/**
 * ARM: horizontal arm length (px) extending from a match card into the gap
 * between columns. Must be ≤ half the column gap (gap-8 = 32px → max ARM = 16).
 */
const ARM = 16;

function slotHeight(roundIndex: number): number {
  const branches = Math.pow(2, roundIndex);
  return SLOT_BASE * branches + (branches - 1) * MATCH_GAP;
}

/** Vertical connector bar bounds (px from slot top) for rounds after the first. */
function connectorVerticalBounds(roundIndex: number, slotH: number): { top: number; bottom: number } {
  const childH = slotHeight(roundIndex - 1);
  const inset = childH / 2;
  return { top: inset, bottom: slotH - inset };
}

type DragInfo = { fightId: string; side: 'a' | 'b'; athleteId: string };

type Props = {
  round: BracketRendererRound;
  roundIndex: number;
  title: string;
  isFirst: boolean;
  isLast: boolean;
  tFightStatus: (key: string) => string;
  tBracket: (key: string, values?: Record<string, string | number | Date>) => string;
  getAthleteHref?: (athleteId: string) => string;
  editMode?: boolean;
  onDragStart?: (info: DragInfo) => void;
  onDrop?: (info: { fightId: string; side: 'a' | 'b' }) => void;
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
  editMode,
  onDragStart,
  onDrop,
}: Props) {
  const slotH = slotHeight(roundIndex);
  const connectorBounds = roundIndex > 0 ? connectorVerticalBounds(roundIndex, slotH) : null;

  return (
    <section
      className={`bracket-round w-[240px] shrink-0 ${
        isFirst ? 'bracket-round--first' : ''
      } ${isLast ? 'bracket-round--last' : ''}`}
    >
      <BracketRoundHeader round={round} title={title} />

      <div className="bracket-round-matches mt-2 flex flex-col" style={{ gap: MATCH_GAP }}>
        {round.matches.map((match) => (
          <div key={match.id} style={{ height: slotH }} className="relative">
            {/* ── Left connectors (rounds after the first) ─────────────────
                Vertical bar spans the midpoints of the two child slots that
                feed this match (accounting for MATCH_GAP). Horizontal arm
                bridges the column gap to the left edge of the match card.
            ──────────────────────────────────────────────────────────── */}
            {!isFirst && connectorBounds && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bg-[var(--color-border)]"
                  style={{
                    left: -ARM,
                    top: connectorBounds.top,
                    height: connectorBounds.bottom - connectorBounds.top,
                    width: 1,
                  }}
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
                editMode={editMode}
                onDragStart={onDragStart}
                onDrop={onDrop}
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
