import type { ScheduleFightRow } from '@/types/api';

// Recommended minimum number of bouts between two fights of the same athlete,
// measured as the difference in running-order positions (an athlete fighting
// at slots 1 and 7 has a 6-fight gap). Below this we flag the *later* fight so
// the admin can drag it further down the order. Display-only — this threshold
// is never enforced by the backend scheduler or shown in any PDF/other page.
export const RECOMMENDED_FIGHT_GAP = 15;

// One finding on a fight:
//   - severity 'error'   → an IMPOSSIBLE ordering: a "Winner of N" corner whose
//     feeder bout runs at the same time or later in the running order, so the
//     winner can't exist yet. `feederBout` is that feeder's running number.
//   - severity 'warning' → a too-short REST gap within a session. `gap` is the
//     number of bouts of rest the corner got.
// `side` says which corner; the name is resolved by the component (it depends
// on the continuous bout numbering), so this stays name-free.
export type ScheduleIssue = {
  side: 'red' | 'blue';
  severity: 'error' | 'warning';
  gap?: number;
  feederBout?: number;
};

export function computeScheduleIssues(
  fightsBySession: ScheduleFightRow[][],
): Map<string, ScheduleIssue[]> {
  const issues = new Map<string, ScheduleIssue[]>();
  const add = (fightId: string, issue: ScheduleIssue) => {
    const list = issues.get(fightId) ?? [];
    list.push(issue);
    issues.set(fightId, list);
  };

  // ── Order errors (RED), checked GLOBALLY across the whole running order ──
  // A feeder bout must run before the bout that consumes its winner — even
  // across sessions. We key by the continuous running position so "Winner of N"
  // can be compared to where N actually sits.
  const ordered = fightsBySession.flat();
  const globalPositionByScheduleOrder = new Map<number, number>();
  ordered.forEach((fight, index) => {
    if (fight.scheduleOrder != null) {
      globalPositionByScheduleOrder.set(fight.scheduleOrder, index + 1);
    }
  });

  ordered.forEach((fight, index) => {
    const position = index + 1;
    const corners: Array<{ side: 'red' | 'blue'; id: string | null; sourceOrder: number | null }> = [
      { side: 'red', id: fight.redAthleteId, sourceOrder: fight.redSourceScheduleOrder },
      { side: 'blue', id: fight.blueAthleteId, sourceOrder: fight.blueSourceScheduleOrder },
    ];
    for (const corner of corners) {
      if (corner.id != null || corner.sourceOrder == null) continue;
      const feederPosition = globalPositionByScheduleOrder.get(corner.sourceOrder);
      if (feederPosition != null && feederPosition >= position) {
        add(fight.id, { side: corner.side, severity: 'error', feederBout: feederPosition });
      }
    }
  });

  // ── Rest-gap warnings (YELLOW), computed independently PER SESSION ──
  // The break between sessions is its own rest, so a bout late in one session
  // and a bout early in the next is never a conflict. A "previous appearance"
  // is either the same athlete (by id) or a "Winner of N" corner whose feeder
  // sits earlier in the SAME session.
  for (const sessionFights of fightsBySession) {
    const lastPositionByAthlete = new Map<string, number>();
    const positionByScheduleOrder = new Map<number, number>();
    sessionFights.forEach((fight, index) => {
      if (fight.scheduleOrder != null) {
        positionByScheduleOrder.set(fight.scheduleOrder, index + 1);
      }
    });

    sessionFights.forEach((fight, index) => {
      const position = index + 1;
      const corners: Array<{ side: 'red' | 'blue'; id: string | null; sourceOrder: number | null }> = [
        { side: 'red', id: fight.redAthleteId, sourceOrder: fight.redSourceScheduleOrder },
        { side: 'blue', id: fight.blueAthleteId, sourceOrder: fight.blueSourceScheduleOrder },
      ];

      for (const corner of corners) {
        let previousPosition: number | null = null;
        if (corner.id != null) {
          previousPosition = lastPositionByAthlete.get(corner.id) ?? null;
        } else if (corner.sourceOrder != null) {
          const sourcePosition = positionByScheduleOrder.get(corner.sourceOrder);
          if (sourcePosition != null && sourcePosition < position) {
            previousPosition = sourcePosition;
          }
        }

        if (previousPosition != null) {
          const gap = position - previousPosition;
          if (gap < RECOMMENDED_FIGHT_GAP) {
            add(fight.id, { side: corner.side, severity: 'warning', gap });
          }
        }

        if (corner.id != null) lastPositionByAthlete.set(corner.id, position);
      }
    });
  }

  return issues;
}
