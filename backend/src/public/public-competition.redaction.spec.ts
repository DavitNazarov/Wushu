import { PublicCompetitionController } from './public-competition.controller';

// Security regression test: the public bracket endpoints must never expose an
// athlete's documentId (national ID). It rides on `athleteCode`, which the
// admin/coach bracket views legitimately carry but the unauthenticated public
// response must have swapped for the athlete UUID. This pins BOTH redaction
// paths — the rounds tree and the flat fights list (the latter was leaking:
// the rounds redaction deep-copies a separate tree and left fights[] raw).

const controller = new PublicCompetitionController(
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
  {} as never,
);

const NATIONAL_ID_RED = '01001000011';
const NATIONAL_ID_BLUE = '02002000022';

const slot = (athleteId: string, athleteCode: string) => ({
  kind: 'ATHLETE',
  athlete: { athleteId, athleteCode, athleteName: 'Someone', clubName: null },
});

const callFightRedact = (rows: unknown[]) =>
  (
    controller as unknown as {
      redactFightListDocumentIds(f: unknown[]): Array<{
        redSlot: { athlete: { athleteId: string; athleteCode: string } | null };
        blueSlot: { athlete: { athleteId: string; athleteCode: string } | null };
      }>;
    }
  ).redactFightListDocumentIds(rows);

describe('public bracket national-ID redaction', () => {
  it('swaps athleteCode for the UUID in the flat fights list', () => {
    const rows = [
      {
        id: 'f1',
        redSlot: slot('uuid-red', NATIONAL_ID_RED),
        blueSlot: slot('uuid-blue', NATIONAL_ID_BLUE),
      },
    ];

    const [redacted] = callFightRedact(rows);

    expect(redacted.redSlot.athlete?.athleteCode).toBe('uuid-red');
    expect(redacted.blueSlot.athlete?.athleteCode).toBe('uuid-blue');
    // The national IDs must not survive anywhere in the public payload.
    expect(JSON.stringify(redacted)).not.toContain(NATIONAL_ID_RED);
    expect(JSON.stringify(redacted)).not.toContain(NATIONAL_ID_BLUE);
  });

  it('leaves empty (BYE/placeholder) slots untouched', () => {
    const rows = [
      {
        id: 'f2',
        redSlot: { kind: 'BYE', athlete: null },
        blueSlot: { kind: 'EMPTY', athlete: null },
      },
    ];

    const [redacted] = callFightRedact(rows);

    expect(redacted.redSlot.athlete).toBeNull();
    expect(redacted.blueSlot.athlete).toBeNull();
  });

  it('also redacts the rounds tree (participants + slots)', () => {
    const NATIONAL_ID = '11111111111';
    const rounds = [
      {
        round: 1,
        matchups: [
          {
            participants: {
              red: { athleteId: 'ur', athleteCode: NATIONAL_ID },
              blue: null,
            },
            slots: {
              red: { athlete: { athleteId: 'ur', athleteCode: NATIONAL_ID } },
              blue: { athlete: null },
            },
          },
        ],
      },
    ];

    const [r] = (
      controller as unknown as {
        redactParticipantDocumentIds(rounds: unknown[]): Array<{
          matchups: Array<{
            participants: { red: { athleteCode: string } | null };
            slots: { red: { athlete: { athleteCode: string } | null } };
          }>;
        }>;
      }
    ).redactParticipantDocumentIds(rounds);

    expect(r.matchups[0].participants.red?.athleteCode).toBe('ur');
    expect(r.matchups[0].slots.red.athlete?.athleteCode).toBe('ur');
    expect(JSON.stringify(r)).not.toContain(NATIONAL_ID);
  });
});
