/** Pure utility functions for bracket generation (no DI needed). */

// Deterministic Fisher-Yates shuffle. Uses a Linear Congruential Generator
// seeded by `seed` so the same input + seed always produce the same output —
// critical because we audit the seed and want admins to be able to reproduce
// a draw byte-for-byte. NOT cryptographically secure (don't use for tokens).
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Smallest power of two ≥ n. Brackets are always sized to a power of two so
// the single-elim tree is balanced; the extra slots become BYEs.
export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// Build a single-elimination bracket from a seeded athlete list.
//   1. Pad to the next power of two with null slots (these become BYEs).
//   2. Re-order leaves with buildSeedOrder so the 1-vs-N, 4-vs-5 standard
//      bracket distribution is preserved — top seeds meet bottom seeds first.
//   3. Walk pairs in each round to emit { round, boutNo, redId, blueId } rows.
//      Subsequent rounds are emitted with null athletes — the actual winner
//      gets propagated in by DrawService.linkFightDependencies + the
//      autoConfirmByes pass after the DB write.
export function buildSingleElimBracket(athleteIds: (string | null)[]): Array<{
  round: number;
  boutNo: number;
  redId: string | null;
  blueId: string | null;
}> {
  const size = nextPowerOfTwo(athleteIds.length);
  const seededParticipants: (string | null)[] = [...athleteIds];
  while (seededParticipants.length < size) seededParticipants.push(null);

  // Bracket leaf order by seed (1vN, 4v5, 2v7, 3v6...) spreads byes correctly.
  const seedOrder = buildSeedOrder(size);
  const firstRoundSlots = seedOrder.map(
    (seedNo) => seededParticipants[seedNo - 1] ?? null,
  );

  const bouts: Array<{
    round: number;
    boutNo: number;
    redId: string | null;
    blueId: string | null;
  }> = [];
  let roundAthletes = firstRoundSlots;
  let round = 1;

  while (roundAthletes.length > 1) {
    const roundBouts: typeof bouts = [];
    for (let i = 0; i < roundAthletes.length; i += 2) {
      roundBouts.push({
        round,
        boutNo: Math.floor(i / 2) + 1,
        redId: roundAthletes[i] ?? null,
        blueId: roundAthletes[i + 1] ?? null,
      });
    }
    bouts.push(...roundBouts);
    roundAthletes = roundBouts.map(() => null);
    round++;
  }

  return bouts;
}

// Recursive construction of the canonical bracket seed order. For size N the
// output is the seed numbers placed left-to-right in the bracket: e.g. size 8
// → [1, 8, 4, 5, 2, 7, 3, 6]. Each level mirrors the previous level around
// the midpoint, which is what gives you the 1-vs-N matchups at every round.
function buildSeedOrder(size: number): number[] {
  if (size <= 1) return [1];
  if (size === 2) return [1, 2];

  const previous = buildSeedOrder(size / 2);
  const current: number[] = [];
  for (const seed of previous) {
    current.push(seed);
    current.push(size + 1 - seed);
  }
  return current;
}

// Round-robin (everyone plays everyone) bouts. Used when there are too few
// athletes for a single-elim bracket to make sense. All bouts are placed in
// round 1 because round-robins have no upstream/downstream propagation;
// boutNo is a monotonically increasing display order.
export function buildRoundRobinBracket(athleteIds: string[]): Array<{
  round: number;
  boutNo: number;
  redId: string;
  blueId: string;
}> {
  const bouts: Array<{
    round: number;
    boutNo: number;
    redId: string;
    blueId: string;
  }> = [];

  let boutNo = 1;
  for (let i = 0; i < athleteIds.length; i += 1) {
    for (let j = i + 1; j < athleteIds.length; j += 1) {
      bouts.push({
        round: 1,
        boutNo,
        redId: athleteIds[i],
        blueId: athleteIds[j],
      });
      boutNo += 1;
    }
  }

  return bouts;
}
