import { RegistrationsService } from './registrations.service';
import { WeighinService } from '../weighin/weighin.service';
import { computeAgeOnDate } from '../competition/athlete-age';

// Characterization tests spanning the two services that encode age +
// category-eligibility rules. They pin behaviour around the Tier-2
// consolidation. Two things are covered:
//
//   1. The UTC `computeAgeOnDate` math, now extracted to one shared helper
//      (../competition/athlete-age) that both RegistrationsService and
//      WeighinService import — previously a byte-identical private copy in
//      each, with a "if you change one, change both" comment. The expectations
//      below are unchanged from before the extraction, so they prove the
//      single source still produces every original result.
//
//   2. The eligibility rules still DIVERGE: RegistrationsService applies the
//      federation's 15-17 -> adult(18+) exception, while WeighinService's
//      reconciliation matcher does NOT. This is pinned, not "fixed" — making
//      them consistent is a product decision, and this test is the tripwire
//      that forces that decision to be deliberate. Both predicates now compute
//      age through the shared helper, so the divergence is purely in the
//      surrounding age-window logic.
//
// `private` is compile-time only in TS, so we reach the eligibility methods
// via the instances. The methods under test don't touch the injected deps, so
// stub constructors are safe.

const reg = new RegistrationsService({} as never, {} as never);
const weighin = new WeighinService({} as never, {} as never, {} as never);

// Date.UTC months are 0-indexed; these helpers keep the test cases readable.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('computeAgeOnDate (characterization)', () => {
  const cases: Array<{ name: string; dob: Date; on: Date; age: number }> = [
    { name: 'exactly on the 18th birthday', dob: utc(2008, 6, 22), on: utc(2026, 6, 22), age: 18 },
    { name: 'birthday is tomorrow (not yet 18)', dob: utc(2008, 6, 23), on: utc(2026, 6, 22), age: 17 },
    { name: 'birthday was yesterday', dob: utc(2008, 6, 21), on: utc(2026, 6, 22), age: 18 },
    { name: 'birth month later in the year', dob: utc(2008, 7, 1), on: utc(2026, 6, 22), age: 17 },
    { name: 'birth month earlier in the year', dob: utc(2008, 5, 15), on: utc(2026, 6, 22), age: 18 },
    { name: 'Feb-29 athlete, day before in a non-leap year', dob: utc(2008, 2, 29), on: utc(2026, 2, 28), age: 17 },
    { name: 'Feb-29 athlete, just past in a non-leap year', dob: utc(2008, 2, 29), on: utc(2026, 3, 1), age: 18 },
    { name: 'year boundary (Dec 31 -> Jan 1)', dob: utc(2010, 12, 31), on: utc(2026, 1, 1), age: 15 },
  ];

  it.each(cases)('$name -> $age', ({ dob, on, age }) => {
    expect(computeAgeOnDate(dob, on)).toBe(age);
  });
});

// --- eligibility predicates -------------------------------------------------

const athlete = (dob: Date, sex: 'MALE' | 'FEMALE' | null) =>
  ({ dateOfBirth: dob, sex }) as never;
const event = (competitionStartDate: Date) =>
  ({ competitionStartDate }) as never;
const category = (
  minAge: number | null,
  maxAge: number | null,
  sex: 'MALE' | 'FEMALE' | null,
) =>
  ({
    eventAgeGroup: { categoryTemplateAgeGroup: { minAge, maxAge, sex } },
  }) as never;

const COMP = utc(2026, 6, 22);
const assertEligible = (dob: Date, sex: 'MALE' | 'FEMALE' | null, cat: never) =>
  (reg as unknown as {
    assertAthleteEligibleForCategory(a: never, e: never, c: never): void;
  }).assertAthleteEligibleForCategory(athlete(dob, sex), event(COMP), cat);

const matchesAgeGroup = (
  dob: Date,
  sex: 'MALE' | 'FEMALE' | null,
  minAge: number | null,
  maxAge: number | null,
  groupSex: 'MALE' | 'FEMALE' | null,
): boolean =>
  (weighin as unknown as {
    athleteMatchesAgeGroup(input: {
      athleteDob: Date;
      athleteSex: 'MALE' | 'FEMALE' | null;
      competitionStartDate: Date;
      ageGroup: {
        minAge: number | null;
        maxAge: number | null;
        sex: 'MALE' | 'FEMALE' | null;
      };
    }): boolean;
  }).athleteMatchesAgeGroup({
    athleteDob: dob,
    athleteSex: sex,
    competitionStartDate: COMP,
    ageGroup: { minAge, maxAge, sex: groupSex },
  });

// A 16-year-old on competition day.
const SIXTEEN = utc(2010, 6, 22);

describe('RegistrationsService eligibility (characterization)', () => {
  it('allows a 16-year-old into an 18+ group (youth->adult exception)', () => {
    expect(() => assertEligible(SIXTEEN, 'MALE', category(18, null, null))).not.toThrow();
  });

  it.each([15, 16, 17])(
    'applies the exception across the whole 15-17 band (age via DOB %s)',
    (age) => {
      const dob = utc(2026 - age, 6, 22);
      expect(() => assertEligible(dob, 'MALE', category(18, null, null))).not.toThrow();
    },
  );

  it('rejects a 14-year-old from an 18+ group (below the exception band)', () => {
    const fourteen = utc(2012, 6, 22);
    expect(() => assertEligible(fourteen, 'MALE', category(18, null, null))).toThrow(
      'ATHLETE_OUT_OF_AGE_GROUP',
    );
  });

  it('allows an adult who meets the minimum age', () => {
    const twenty = utc(2006, 6, 22);
    expect(() => assertEligible(twenty, 'MALE', category(18, null, null))).not.toThrow();
  });

  it('rejects an athlete over the maximum age', () => {
    const twenty = utc(2006, 6, 22);
    expect(() => assertEligible(twenty, 'MALE', category(null, 17, null))).toThrow(
      'ATHLETE_OUT_OF_AGE_GROUP',
    );
  });

  it('allows a youth inside an explicit youth band', () => {
    expect(() => assertEligible(SIXTEEN, 'FEMALE', category(12, 17, null))).not.toThrow();
  });

  it('rejects a sex mismatch', () => {
    const twenty = utc(2006, 6, 22);
    expect(() => assertEligible(twenty, 'MALE', category(18, null, 'FEMALE'))).toThrow(
      'ATHLETE_SEX_MISMATCH_FOR_CATEGORY',
    );
  });

  it('ignores sex when the athlete has no recorded sex', () => {
    const twenty = utc(2006, 6, 22);
    expect(() => assertEligible(twenty, null, category(18, null, 'FEMALE'))).not.toThrow();
  });
});

describe('WeighinService eligibility (characterization — documents the divergence)', () => {
  // THE DIVERGENCE: the same 16-year-old that RegistrationsService admits into
  // an 18+ group is rejected here, because this matcher has no youth exception.
  it('REJECTS a 16-year-old from an 18+ group (no youth->adult exception here)', () => {
    expect(matchesAgeGroup(SIXTEEN, 'MALE', 18, null, null)).toBe(false);
  });

  it('accepts an adult who meets the minimum age', () => {
    const twenty = utc(2006, 6, 22);
    expect(matchesAgeGroup(twenty, 'MALE', 18, null, null)).toBe(true);
  });

  it('accepts a youth inside an explicit youth band', () => {
    expect(matchesAgeGroup(SIXTEEN, 'FEMALE', 12, 17, null)).toBe(true);
  });

  it('rejects an athlete over the maximum age', () => {
    const twenty = utc(2006, 6, 22);
    expect(matchesAgeGroup(twenty, 'MALE', null, 17, null)).toBe(false);
  });

  it('rejects a sex mismatch', () => {
    const twenty = utc(2006, 6, 22);
    expect(matchesAgeGroup(twenty, 'MALE', 18, null, 'FEMALE')).toBe(false);
  });
});
