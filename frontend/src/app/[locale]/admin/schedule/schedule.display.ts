import { localizedName } from '@/lib/bilingual';
import type { ScheduleFightRow } from '@/types/api';

// Continuous bout number for a fight: its 1-based position in the running order
// (sessions in order, then orderInSession), keyed by the fight's scheduleOrder.
// Built once per render in SchedulePageClient and threaded down so the badge
// number and the "Winner of N" placeholder reference the SAME running number.
export type BoutNumbering = Map<number, number>;

export function buildBoutNumbering(orderedFights: ScheduleFightRow[]): BoutNumbering {
  const map: BoutNumbering = new Map();
  orderedFights.forEach((fight, index) => {
    if (fight.scheduleOrder != null) map.set(fight.scheduleOrder, index + 1);
  });
  return map;
}

// The badge number shown on a fight card — its own running-order position.
export function boutNumber(fight: ScheduleFightRow, numbering: BoutNumbering): number | null {
  return fight.scheduleOrder != null ? (numbering.get(fight.scheduleOrder) ?? null) : null;
}

// Resolve one corner's display string. A real athlete keeps their localized
// name; an undecided "Winner of N" corner is relabelled to the feeder bout's
// running-order number (so it matches a visible badge) via winnerOf(); a bare
// placeholder falls back to its backend string ("TBD").
export function resolveCornerName(args: {
  athleteId: string | null;
  sourceScheduleOrder: number | null;
  displayName: string;
  displayNameKa: string | null;
  locale: string;
  numbering: BoutNumbering;
  winnerOf: (n: number) => string;
}): string {
  if (args.athleteId) {
    return localizedName(args.displayName, args.displayNameKa, args.locale);
  }
  if (args.sourceScheduleOrder != null) {
    const n = args.numbering.get(args.sourceScheduleOrder);
    if (n != null) return args.winnerOf(n);
  }
  return localizedName(args.displayName, args.displayNameKa, args.locale);
}
