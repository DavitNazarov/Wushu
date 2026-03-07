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
  const padded: (string | null)[] = [...athleteIds];
  while (padded.length < size) padded.push(null);

  const bouts: Array<{
    round: number;
    boutNo: number;
    redId: string | null;
    blueId: string | null;
  }> = [];
  let roundAthletes = padded;
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
