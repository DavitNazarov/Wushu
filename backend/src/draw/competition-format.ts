// Tournament format options for a single category's bracket.
//   DIRECT_FINAL       — 0–2 athletes: nothing to bracket, just one final.
//   ROUND_ROBIN        — 3 athletes: everyone plays everyone.
//   SINGLE_ELIMINATION — 4+ athletes: knockout tree.
export type CompetitionFormat =
  | 'DIRECT_FINAL'
  | 'ROUND_ROBIN'
  | 'SINGLE_ELIMINATION';

// Pick a format based on athlete count. Accepts both `athleteCount` and
// `eligibleAthletesCount` for ergonomics — different callers use different
// names. Negative counts are clamped to zero. category/ruleset are reserved
// for future format-by-policy decisions; currently ignored.
export function resolveCompetitionFormat(input: {
  eligibleAthletesCount?: number;
  athleteCount?: number;
  category?: unknown;
  ruleset?: unknown;
}): CompetitionFormat {
  const athleteCount = Math.max(
    0,
    input.athleteCount ?? input.eligibleAthletesCount ?? 0,
  );

  if (athleteCount <= 2) return 'DIRECT_FINAL';
  if (athleteCount === 3) return 'ROUND_ROBIN';
  return 'SINGLE_ELIMINATION';
}
