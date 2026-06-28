// End-to-end check: runs the app's OWN computeCategoryResults over every seeded
// bracket and tallies medals. Proves the results/medal pipeline works on the
// imported data. Run from backend/ with DATABASE_URL pointed at the target DB.
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  computeCategoryResults,
  type CompetitionFight,
} from '../../src/competition/competition.logic';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const events = await prisma.event.findMany({ select: { id: true, name: true } });
  for (const ev of events) {
    const brackets = await prisma.bracket.findMany({
      where: { eventId: ev.id },
      select: { id: true, categoryCode: true, format: true },
    });
    let gold = 0, silver = 0, bronze = 0, complete = 0;
    const samples: string[] = [];
    for (const b of brackets) {
      const fights = await prisma.fight.findMany({
        where: { bracketId: b.id },
        select: {
          id: true, round: true, boutNo: true, status: true,
          redAthleteId: true, blueAthleteId: true, winnerAthleteId: true, winMethod: true,
          redAthlete: { select: { firstName: true, lastName: true } },
          blueAthlete: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ round: 'asc' }, { boutNo: 'asc' }],
      });
      const nameById = new Map<string, string>();
      for (const f of fights) {
        if (f.redAthleteId && f.redAthlete) nameById.set(f.redAthleteId, `${f.redAthlete.firstName} ${f.redAthlete.lastName}`);
        if (f.blueAthleteId && f.blueAthlete) nameById.set(f.blueAthleteId, `${f.blueAthlete.firstName} ${f.blueAthlete.lastName}`);
      }
      const res = computeCategoryResults({
        format: b.format,
        fights: fights as unknown as CompetitionFight[],
        athletes: [...nameById].map(([athleteId, athleteName]) => ({ athleteId, athleteName })),
        bronzePolicy: 'TWO_BRONZES',
      });
      const g = res.placements.find((p) => p.medal === 'GOLD');
      const s = res.placements.find((p) => p.medal === 'SILVER');
      const br = res.placements.filter((p) => p.medal === 'BRONZE');
      if (g) gold++;
      if (s) silver++;
      bronze += br.length;
      if (res.isComplete) complete++;
      if (samples.length < 3 && g?.athleteId && s?.athleteId) {
        const nm = (id: string | null) => (id ? nameById.get(id) ?? id : '?');
        samples.push(
          `   ${b.format.padEnd(18)} 🥇 ${nm(g.athleteId)}  🥈 ${nm(s.athleteId)}  🥉 ${br.map((x) => nm(x.athleteId)).join(', ')}`,
        );
      }
    }
    console.log(`\n${ev.name}`);
    console.log(`   brackets: ${brackets.length}, complete: ${complete}, golds: ${gold}, silvers: ${silver}, bronzes: ${bronze}`);
    samples.forEach((s) => console.log(s));
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
