/**
 * Generates realistic competition results (brackets + confirmed fights) for
 * every COMPLETED event of the Georgian Wushu Federation.
 *
 * This powers the public "Hall of Fame" (top athletes), top clubs, and the
 * per-event public results / medal table — all of which read from confirmed
 * Fight records.
 *
 * Deterministic: winner selection is a stable hash of (eventSlug + athleteId),
 * so re-running produces the same medal outcomes. Safe to run multiple times —
 * an event that already has fights is skipped.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type WinMethod } from '@prisma/client';
import { buildSingleElimBracket } from '../src/draw/draw.utils';
import { ATHLETES, ORG_SLUG } from './seed-mock-data';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient(
  { adapter } as ConstructorParameters<typeof PrismaClient>[0],
);

// Stable string hash → unsigned 32-bit int
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Per-athlete "skill" within an event — deterministic, spread 0..999
function skillScore(eventSlug: string, athleteId: string): number {
  return hash(`${eventSlug}:${athleteId}`) % 1000;
}

function pickWinMethod(eventSlug: string, fightKey: string): WinMethod {
  const r = hash(`${eventSlug}:${fightKey}`) % 10;
  if (r === 0) return 'KO';
  if (r === 1) return 'WO';
  return 'POINTS';
}

// Parse the numeric weight out of a category weight name ("70kg", "+100kg", "24kg")
function parseWeight(name: string): number {
  const m = name.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// Broad competition divisions per age/sex group so athletes cluster into
// real brackets instead of one-person categories. Thresholds are inclusive
// upper bounds for Light / Middle; anything heavier is Heavy.
const DIVISION_THRESHOLDS: Record<string, { light: number; middle: number }> = {
  'children-boys-sanda':  { light: 30, middle: 39 },
  'children-girls-sanda': { light: 30, middle: 39 },
  'junior-boys-sanda':    { light: 52, middle: 65 },
  'junior-girls-sanda':   { light: 48, middle: 56 },
  'youth-boys-sanda':     { light: 60, middle: 75 },
  'youth-girls-sanda':    { light: 52, middle: 60 },
  'adults-men-sanda':     { light: 65, middle: 80 },
  'adults-women-sanda':   { light: 56, middle: 65 },
};

function weightDivision(group: string, weightName: string): string {
  const t = DIVISION_THRESHOLDS[group];
  const w = parseWeight(weightName);
  if (!t) return 'Open';
  if (w <= t.light) return 'Lightweight';
  if (w <= t.middle) return 'Middleweight';
  return 'Heavyweight';
}

type Bout = { round: number; boutNo: number; redId: string | null; blueId: string | null };

/** Resolve a single-elimination bracket, returning only fights with two real athletes. */
function resolveSingleElim(
  eventSlug: string,
  athleteIds: string[],
): Array<Bout & { winnerId: string; loserId: string }> {
  const bouts = buildSingleElimBracket(athleteIds) as Bout[];
  const byRound = new Map<number, Bout[]>();
  for (const b of bouts) {
    const arr = byRound.get(b.round) ?? [];
    arr.push(b);
    byRound.set(b.round, arr);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const resolved: Array<Bout & { winnerId: string; loserId: string }> = [];
  // winners[`${round}:${boutNo}`] = athleteId that advances out of that bout
  const winnerOf = new Map<string, string>();

  for (const round of rounds) {
    const roundBouts = (byRound.get(round) ?? []).sort(
      (a, b) => a.boutNo - b.boutNo,
    );
    for (const bout of roundBouts) {
      // Round 1 takes red/blue from the bracket; later rounds from prior winners
      let redId = bout.redId;
      let blueId = bout.blueId;
      if (round > 1) {
        redId = winnerOf.get(`${round - 1}:${bout.boutNo * 2 - 1}`) ?? null;
        blueId = winnerOf.get(`${round - 1}:${bout.boutNo * 2}`) ?? null;
      }

      let advancing: string | null = null;
      if (redId && blueId) {
        const redScore = skillScore(eventSlug, redId);
        const blueScore = skillScore(eventSlug, blueId);
        const redWins =
          redScore !== blueScore ? redScore > blueScore : redId < blueId;
        const winnerId = redWins ? redId : blueId;
        const loserId = redWins ? blueId : redId;
        resolved.push({ ...bout, redId, blueId, winnerId, loserId });
        advancing = winnerId;
      } else {
        advancing = redId ?? blueId; // bye — no fight recorded
      }
      if (advancing) winnerOf.set(`${round}:${bout.boutNo}`, advancing);
    }
  }
  return resolved;
}

/** Round-robin for exactly 3 athletes — every pairing fights once. */
function resolveRoundRobin(
  eventSlug: string,
  ids: string[],
): Array<{ round: number; boutNo: number; redId: string; blueId: string; winnerId: string; loserId: string }> {
  const pairs: Array<[string, string]> = [
    [ids[0], ids[1]],
    [ids[0], ids[2]],
    [ids[1], ids[2]],
  ];
  return pairs.map(([redId, blueId], idx) => {
    const redScore = skillScore(eventSlug, redId);
    const blueScore = skillScore(eventSlug, blueId);
    const redWins =
      redScore !== blueScore ? redScore > blueScore : redId < blueId;
    return {
      round: 1,
      boutNo: idx + 1,
      redId,
      blueId,
      winnerId: redWins ? redId : blueId,
      loserId: redWins ? blueId : redId,
    };
  });
}

export async function runResultsSeed() {
  const org = await prisma.organisation.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.log(
      `Org "${ORG_SLUG}" not found — run the mock-data seed first. Skipping results.`,
    );
    return;
  }

  // docId → { categoryGroup, categoryWeightName }
  const catByDocId = new Map(
    ATHLETES.map((a) => [
      a.docId,
      { group: a.categoryGroup, weight: a.categoryWeightName },
    ]),
  );

  const completedEvents = await prisma.event.findMany({
    where: { organisationId: org.id, lifecycle: 'COMPLETED' },
    orderBy: { competitionStartDate: 'asc' },
  });

  if (completedEvents.length === 0) {
    console.log('No COMPLETED events found. Nothing to do.');
    return;
  }

  console.log('Generating competition results for completed events…');

  for (const event of completedEvents) {
    // Mock data: always regenerate so reruns reflect the latest logic.
    const existingFights = await prisma.fight.count({
      where: { eventId: event.id },
    });
    if (existingFights > 0) {
      await prisma.fight.deleteMany({ where: { eventId: event.id } });
      await prisma.bracket.deleteMany({ where: { eventId: event.id } });
      console.log(
        `  • "${event.name}": cleared ${existingFights} old fights, regenerating…`,
      );
    }

    // Athletes that actually competed = APPROVED registrations that were not
    // failed/disqualified at weigh-in.
    const regs = await prisma.registration.findMany({
      where: {
        eventId: event.id,
        status: 'APPROVED',
        weighInStatus: { notIn: ['FAILED', 'DISQUALIFIED'] },
      },
      select: {
        athleteId: true,
        athlete: { select: { documentId: true } },
      },
    });

    // Bucket by age-group + broad weight division
    // (e.g. "adults-men-sanda::Middleweight")
    const buckets = new Map<string, { group: string; division: string; athleteIds: string[] }>();
    for (const r of regs) {
      const cat = catByDocId.get(r.athlete.documentId);
      if (!cat) continue;
      const division = weightDivision(cat.group, cat.weight);
      const key = `${cat.group}::${division}`;
      const bucket =
        buckets.get(key) ?? { group: cat.group, division, athleteIds: [] };
      bucket.athleteIds.push(r.athleteId);
      buckets.set(key, bucket);
    }

    let bracketCount = 0;
    let fightCount = 0;
    const confirmedAt = event.competitionEndDate;

    for (const [key, bucket] of buckets.entries()) {
      const ids = bucket.athleteIds;
      if (ids.length < 2) continue; // need at least a final

      // Unique per event: "adults-men-sanda-Middleweight"
      const categoryCode = `${bucket.group}-${bucket.division}`;

      const bracket = await prisma.bracket.create({
        data: {
          organisationId: org.id,
          eventId: event.id,
          categoryCode,
          seed: hash(`${event.slug}:${key}`) % 100000,
        },
      });
      bracketCount++;

      const fights =
        ids.length === 3
          ? resolveRoundRobin(event.slug, ids)
          : resolveSingleElim(event.slug, ids);

      for (const f of fights) {
        await prisma.fight.create({
          data: {
            organisationId: org.id,
            eventId: event.id,
            bracketId: bracket.id,
            categoryCode,
            round: f.round,
            boutNo: f.boutNo,
            redAthleteId: f.redId,
            blueAthleteId: f.blueId,
            status: 'CONFIRMED',
            winnerAthleteId: f.winnerId,
            loserAthleteId: f.loserId,
            winMethod: pickWinMethod(event.slug, `${categoryCode}:${f.round}:${f.boutNo}`),
            confirmedAt,
          },
        });
        fightCount++;
      }
    }

    console.log(
      `  ✓ "${event.name}": ${bracketCount} brackets, ${fightCount} confirmed fights`,
    );
  }

  console.log('\nResults seed complete. Hall of Fame & medal tables are now populated.');
}

async function main() {
  try {
    await runResultsSeed();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
