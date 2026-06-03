import {
  seededShuffle,
  nextPowerOfTwo,
  buildSingleElimBracket,
} from './draw.utils';

// Pure-function tests for the bracket math primitives. No mocks, no DB —
// pin the exact behavior so a refactor to the algorithm gets caught.

// Sanity checks for the smallest-power-of-two padding helper.
describe('nextPowerOfTwo', () => {
  it('returns 1 for n=1', () => expect(nextPowerOfTwo(1)).toBe(1));
  it('returns 2 for n=2', () => expect(nextPowerOfTwo(2)).toBe(2));
  it('returns 4 for n=3', () => expect(nextPowerOfTwo(3)).toBe(4));
  it('returns 8 for n=5', () => expect(nextPowerOfTwo(5)).toBe(8));
  it('returns 8 for n=8', () => expect(nextPowerOfTwo(8)).toBe(8));
});

// Verify the seeded shuffle is (a) length-preserving and (b) deterministic
// — critical because we audit the seed and want reproducible draws.
describe('seededShuffle', () => {
  it('returns same length array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(arr, 42)).toHaveLength(4);
  });

  it('contains same elements', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(arr, 42).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is deterministic for same seed', () => {
    const arr = ['a', 'b', 'c', 'd'];
    expect(seededShuffle(arr, 99)).toEqual(seededShuffle(arr, 99));
  });

  it('does not mutate original array', () => {
    const arr = ['a', 'b', 'c'];
    seededShuffle(arr, 1);
    expect(arr).toEqual(['a', 'b', 'c']);
  });
});

describe('buildSingleElimBracket', () => {
  it('handles 1 athlete — 0 bouts (single player, no fight needed)', () => {
    const bouts = buildSingleElimBracket(['a1']);
    expect(bouts).toHaveLength(0);
  });

  it('handles 2 athletes — 1 bout, no byes', () => {
    const bouts = buildSingleElimBracket(['a1', 'a2']);
    expect(bouts).toHaveLength(1);
    expect(bouts[0].round).toBe(1);
    expect(bouts[0].redId).toBe('a1');
    expect(bouts[0].blueId).toBe('a2');
  });

  it('handles 3 athletes — pads to 4, 2 rounds total', () => {
    const bouts = buildSingleElimBracket(['a1', 'a2', 'a3']);
    const round1 = bouts.filter((b) => b.round === 1);
    const round2 = bouts.filter((b) => b.round === 2);
    expect(round1).toHaveLength(2);
    expect(round2).toHaveLength(1);
    const byeBout = round1.find((b) => b.redId === null || b.blueId === null);
    expect(byeBout).toBeDefined();
  });

  it('handles 4 athletes — 2 rounds, 3 bouts total', () => {
    const bouts = buildSingleElimBracket(['a1', 'a2', 'a3', 'a4']);
    expect(bouts).toHaveLength(3);
    expect(bouts.filter((b) => b.round === 1)).toHaveLength(2);
    expect(bouts.filter((b) => b.round === 2)).toHaveLength(1);
  });

  it('handles 8 athletes — 3 rounds, 7 bouts total, round 1 has no byes', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `a${i + 1}`);
    const bouts = buildSingleElimBracket(ids);
    expect(bouts).toHaveLength(7);
    const round1 = bouts.filter((b) => b.round === 1);
    expect(round1).toHaveLength(4);
    // All round-1 bouts should have real athletes (no byes)
    expect(round1.every((b) => b.redId !== null && b.blueId !== null)).toBe(
      true,
    );
  });

  it('distributes byes in 5-athlete bracket so round 1 has no double-bye fight', () => {
    const bouts = buildSingleElimBracket(['a1', 'a2', 'a3', 'a4', 'a5']);
    const round1 = bouts.filter((b) => b.round === 1);
    expect(round1).toHaveLength(4);
    expect(round1.some((b) => b.redId === null && b.blueId === null)).toBe(
      false,
    );
  });

  it('assigns correct boutNo within each round', () => {
    const bouts = buildSingleElimBracket(['a1', 'a2', 'a3', 'a4']);
    const round1 = bouts
      .filter((b) => b.round === 1)
      .sort((a, b) => a.boutNo - b.boutNo);
    expect(round1.map((b) => b.boutNo)).toEqual([1, 2]);
  });
});
