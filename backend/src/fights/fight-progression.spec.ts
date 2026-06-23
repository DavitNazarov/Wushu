import { propagateWinnerToNextFight } from './fight-progression';

// Unit-tests the shared winner-propagation persistence helper with a mocked
// transaction client. This is the local verification for the Tier-2
// consolidation that gave the draw path the downstream-lock guard it lacked:
// the DrawService BYE cascade and the live FightsService result flow now share
// this exact logic. (The full draw cascade is covered by the bye-progression
// e2e in CI; this pins the helper's decisions deterministically.)

type NextFight = {
  id: string;
  redAthleteId: string | null;
  blueAthleteId: string | null;
  status: string;
  winnerAthleteId: string | null;
  loserAthleteId: string | null;
  winMethod: string | null;
  confirmedAt: Date | null;
  timerState: { state: string } | null;
};

const baseNext = (over: Partial<NextFight> = {}): NextFight => ({
  id: 'next_1',
  redAthleteId: null,
  blueAthleteId: null,
  status: 'QUEUED',
  winnerAthleteId: null,
  loserAthleteId: null,
  winMethod: null,
  confirmedAt: null,
  timerState: { state: 'IDLE' },
  ...over,
});

const makeTx = (nextFight: NextFight | null) => {
  const update = jest.fn(async ({ data }) => ({ ...baseNext(), ...data }));
  const findUnique = jest.fn(async () => nextFight);
  return { tx: { fight: { findUnique, update } } as never, findUnique, update };
};

const source = {
  winnerAthleteId: 'winner',
  nextFightId: 'next_1',
  nextFightSlot: 'RED' as const,
};

describe('propagateWinnerToNextFight', () => {
  it('no-ops (returns null) when the source has no winner', async () => {
    const { tx, findUnique } = makeTx(baseNext());
    const result = await propagateWinnerToNextFight(tx, {
      ...source,
      winnerAthleteId: null,
    });
    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('no-ops when there is no next fight (final bout)', async () => {
    const { tx, findUnique } = makeTx(baseNext());
    const result = await propagateWinnerToNextFight(tx, {
      ...source,
      nextFightId: null,
    });
    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns null when the next fight row is missing', async () => {
    const { tx, update } = makeTx(null);
    const result = await propagateWinnerToNextFight(tx, source);
    expect(result).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('writes the winner into the RED slot of a fresh QUEUED next fight', async () => {
    const { tx, update } = makeTx(baseNext());
    await propagateWinnerToNextFight(tx, source);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'next_1' },
      data: { redAthleteId: 'winner' },
    });
  });

  it('writes into the BLUE slot when the source feeds the blue corner', async () => {
    const { tx, update } = makeTx(baseNext());
    await propagateWinnerToNextFight(tx, { ...source, nextFightSlot: 'BLUE' });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'next_1' },
      data: { blueAthleteId: 'winner' },
    });
  });

  it('is idempotent: no write when the slot already holds the winner', async () => {
    const { tx, update } = makeTx(baseNext({ redAthleteId: 'winner' }));
    const result = await propagateWinnerToNextFight(tx, source);
    expect(update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ redAthleteId: 'winner' });
  });

  // The guard the draw copy was missing — exercised on every path now.
  it('does NOT overwrite a downstream fight that has already started', async () => {
    const { tx, update } = makeTx(baseNext({ status: 'IN_PROGRESS' }));
    const result = await propagateWinnerToNextFight(tx, source);
    expect(update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'IN_PROGRESS' });
  });

  it('does NOT overwrite a downstream fight that already has a result', async () => {
    const { tx, update } = makeTx(baseNext({ winnerAthleteId: 'someone' }));
    await propagateWinnerToNextFight(tx, source);
    expect(update).not.toHaveBeenCalled();
  });

  it('does NOT overwrite when the downstream timer is running', async () => {
    const { tx, update } = makeTx(baseNext({ timerState: { state: 'RUNNING' } }));
    await propagateWinnerToNextFight(tx, source);
    expect(update).not.toHaveBeenCalled();
  });
});
