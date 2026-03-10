/** Pure utility functions for bracket generation (no DI needed). */

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

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

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
