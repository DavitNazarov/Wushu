import { resolveBracketParticipantSlot } from './bracket-slot-resolver';
import type { BracketParticipantView } from './brackets.types';

// Pin the four-way slot resolution decision tree (ATHLETE / WINNER_PLACEHOLDER /
// BYE / TBD) since the bracket UI shape depends on it directly.

// Tiny athlete-fixture builder — keeps the assertions readable.
function athlete(name: string): BracketParticipantView {
  return {
    athleteId: name.toLowerCase().replace(/\s+/g, '_'),
    athleteName: name,
    clubName: 'Club',
    country: 'GE',
    athleteCode: 'A-1',
    movedUp: false,
    overrideUsed: false,
    originalCategory: null,
    finalCategory: null,
  };
}

describe('resolveBracketParticipantSlot', () => {
  it('returns athlete slots for known participants', () => {
    const slot = resolveBracketParticipantSlot({
      side: 'red',
      fight: {
        round: 1,
        boutNo: 1,
        redAthleteId: 'athlete_1',
        blueAthleteId: 'athlete_2',
      },
      participant: athlete('Ana Gogoladze'),
      competitionFormat: 'SINGLE_ELIMINATION',
      openingRound: 1,
      getSourceFight: () => null,
    });

    expect(slot.kind).toBe('ATHLETE');
    expect(slot.athlete?.athleteName).toBe('Ana Gogoladze');
    expect(slot.sourceBoutNo).toBeNull();
  });

  it('returns bye slots only for true structural byes', () => {
    const slot = resolveBracketParticipantSlot({
      side: 'blue',
      fight: {
        round: 1,
        boutNo: 2,
        redAthleteId: 'athlete_1',
        blueAthleteId: null,
      },
      participant: null,
      competitionFormat: 'SINGLE_ELIMINATION',
      openingRound: 1,
      getSourceFight: () => null,
    });

    expect(slot.kind).toBe('BYE');
    expect(slot.sourceBoutNo).toBeNull();
  });

  it('returns winner placeholders for unresolved semifinal and final dependencies', () => {
    const finalRedSlot = resolveBracketParticipantSlot({
      side: 'red',
      fight: {
        round: 3,
        boutNo: 1,
        redAthleteId: null,
        blueAthleteId: null,
      },
      participant: null,
      competitionFormat: 'SINGLE_ELIMINATION',
      openingRound: 1,
      getSourceFight: (sourceBoutNo) =>
        sourceBoutNo === 1 ? { id: 'sf_1' } : null,
    });
    const semifinalBlueSlot = resolveBracketParticipantSlot({
      side: 'blue',
      fight: {
        round: 2,
        boutNo: 1,
        redAthleteId: 'athlete_1',
        blueAthleteId: null,
      },
      participant: null,
      competitionFormat: 'SINGLE_ELIMINATION',
      openingRound: 1,
      getSourceFight: (sourceBoutNo) =>
        sourceBoutNo === 2 ? { id: 'qf_2' } : null,
    });

    expect(finalRedSlot.kind).toBe('WINNER_PLACEHOLDER');
    expect(finalRedSlot.sourceBoutNo).toBe(1);
    expect(semifinalBlueSlot.kind).toBe('WINNER_PLACEHOLDER');
    expect(semifinalBlueSlot.sourceBoutNo).toBe(2);
  });
});
