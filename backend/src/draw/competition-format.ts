export type CompetitionFormat =
  | 'DIRECT_FINAL'
  | 'ROUND_ROBIN'
  | 'SINGLE_ELIMINATION';

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
