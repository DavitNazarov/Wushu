/**
 * Seeds the real 2024-2026 Sanda events from the curated wushu-seed.json
 * (produced by build-seed.mjs). Self-contained: creates the organisation,
 * geography, clubs, a shared category template, all athletes, and per-event
 * registrations, weigh-ins, brackets and confirmed fights, plus one admin user.
 *
 * Re-runnable against an existing database. Shared rows are reused/upserted,
 * and an event whose slug already exists is skipped. Run from backend/:
 *   npx ts-node prisma/import/seed-import.ts
 *
 * Env:
 *   DATABASE_URL          target DB (required)
 *   SEED_ADMIN_EMAIL      admin login (default admin@georgian-wushu-federation.ge)
 *   SEED_ADMIN_PASSWORD   admin password (default ChangeMe123!)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { readFileSync } from 'fs';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  type AthleteSex,
  type BracketFormat,
  type WinMethod,
} from '@prisma/client';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient(
  { adapter } as ConstructorParameters<typeof PrismaClient>[0],
);

type Seed = typeof import('./wushu-seed.json');
const data = JSON.parse(
  readFileSync(path.resolve(__dirname, 'wushu-seed.json'), 'utf8'),
) as Seed;

const ADMIN_EMAIL =
  process.env['SEED_ADMIN_EMAIL'] ?? 'admin@georgian-wushu-federation.ge';
const ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD'] ?? 'ChangeMe123!';
const COACH_PASSWORD = process.env['SEED_COACH_PASSWORD'] ?? 'CoachPass123!';

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const catKey = (sex: string, ageGroupKey: string, weightKey: string) =>
  `${sex}|${ageGroupKey}|${weightKey}`;

async function main() {
  console.log(`Seeding real events into ${connectionString!.replace(/:[^:@/]+@/, ':****@')}`);

  // 1. Organisation -------------------------------------------------------
  const org = await prisma.organisation.upsert({
    where: { slug: data.organisation.slug },
    update: {},
    create: { name: data.organisation.name, slug: data.organisation.slug },
  });
  console.log(`✓ Organisation: ${org.name}`);

  // 2. Countries ---------------------------------------------------------
  const countryId = new Map<string, string>();
  for (const c of data.countries) {
    const country = await prisma.country.upsert({
      where: { organisationId_name: { organisationId: org.id, name: c.name } },
      update: { nameKa: c.nameKa, code: c.code },
      create: { organisationId: org.id, name: c.name, nameKa: c.nameKa, code: c.code },
    });
    countryId.set(c.code, country.id);
  }

  // 2b. Cities (Georgian municipalities + one per foreign country) --------
  const cityId = new Map<string, string>(); // by city key
  for (const r of data.cities) {
    const city = await prisma.city.upsert({
      where: {
        organisationId_countryId_name: {
          organisationId: org.id,
          countryId: countryId.get(r.countryCode)!,
          name: r.name,
        },
      },
      update: { nameKa: r.nameKa },
      create: {
        organisationId: org.id,
        countryId: countryId.get(r.countryCode)!,
        name: r.name,
        nameKa: r.nameKa,
      },
    });
    cityId.set(r.key, city.id);
  }

  // 2c. Federations (only the real ones; most clubs are independent) ------
  const federationId = new Map<string, string>(); // by federation key
  for (const f of data.federations) {
    const fedCity = await prisma.city.findUniqueOrThrow({
      where: { id: cityId.get(f.cityKey)! },
      select: { countryId: true },
    });
    const fed = await prisma.federation.upsert({
      where: {
        organisationId_cityId_name: {
          organisationId: org.id,
          cityId: cityId.get(f.cityKey)!,
          name: f.name,
        },
      },
      update: { nameKa: f.nameKa, countryId: fedCity.countryId },
      create: {
        organisationId: org.id,
        cityId: cityId.get(f.cityKey)!,
        countryId: fedCity.countryId,
        name: f.name,
        nameKa: f.nameKa,
      },
    });
    federationId.set(f.key, fed.id);
  }
  console.log(
    `✓ Countries: ${data.countries.length}, cities: ${data.cities.length}, federations: ${data.federations.length}`,
  );

  // 3. Clubs --------------------------------------------------------------
  const clubId = new Map<string, string>();
  for (const c of data.clubs) {
    const existing = await prisma.club.findFirst({
      where: {
        organisationId: org.id,
        countryId: countryId.get(c.countryCode)!,
        cityId: cityId.get(c.cityKey)!,
        name: c.name,
      },
    });
    const dataForClub = {
        organisationId: org.id,
        name: c.name,
        nameKa: c.nameKa,
        countryId: countryId.get(c.countryCode)!,
        cityId: cityId.get(c.cityKey)!,
        federationId: c.federationKey ? federationId.get(c.federationKey) ?? null : null,
      };
    const club = existing
      ? await prisma.club.update({
          where: { id: existing.id },
          data: {
            nameKa: dataForClub.nameKa,
            countryId: dataForClub.countryId,
            cityId: dataForClub.cityId,
            federationId: dataForClub.federationId,
          },
        })
      : await prisma.club.create({ data: dataForClub });
    clubId.set(c.key, club.id);
  }
  console.log(`✓ Clubs: ${data.clubs.length}`);

  // 4. Shared category template ------------------------------------------
  const templateDefinition = { type: 'CATEGORY_TEMPLATE', source: 'IMPORT_2024_2026' };
  const template = await prisma.categoryTemplate.upsert({
    where: {
      organisationId_name_version: {
        organisationId: org.id,
        name: data.categoryTemplate.name,
        version: 1,
      },
    },
    update: {
      status: 'ACTIVE',
      definition: templateDefinition,
    },
    create: {
      organisationId: org.id,
      name: data.categoryTemplate.name,
      version: 1,
      status: 'ACTIVE',
      definition: templateDefinition,
    },
  });
  const templateAgeGroupId = new Map<string, string>(); // code -> id
  const templateWeightId = new Map<string, string>(); // catKey -> id
  const weightNameByCat = new Map<string, string>(); // catKey -> weight name (for display categoryCode)
  const ageGroupCodeByCat = new Map<string, string>(); // catKey -> ageGroup code
  for (const g of data.categoryTemplate.ageGroups) {
    const ag = await prisma.categoryTemplateAgeGroup.upsert({
      where: {
        categoryTemplateId_code: {
          categoryTemplateId: template.id,
          code: g.code,
        },
      },
      update: {
        name: g.name,
        nameKa: g.nameKa,
        sex: g.sex as AthleteSex,
        minAge: g.minAge,
        maxAge: g.maxAge,
        roundDurationSeconds: g.roundDurationSeconds,
        sortOrder: g.sortOrder,
      },
      create: {
        categoryTemplateId: template.id,
        code: g.code,
        name: g.name,
        nameKa: g.nameKa,
        sex: g.sex as AthleteSex,
        minAge: g.minAge,
        maxAge: g.maxAge,
        roundDurationSeconds: g.roundDurationSeconds,
        sortOrder: g.sortOrder,
      },
    });
    templateAgeGroupId.set(g.code, ag.id);
    for (const w of g.weights) {
      const existingWeight = await prisma.categoryTemplateWeight.findFirst({
        where: {
          ageGroupId: ag.id,
          name: w.name,
          minWeightKgExcl: w.minWeightKgExcl,
          maxWeightKgIncl: w.maxWeightKgIncl,
        },
      });
      const dataForWeight = {
          ageGroupId: ag.id,
          name: w.name,
          minWeightKgExcl: w.minWeightKgExcl,
          maxWeightKgIncl: w.maxWeightKgIncl,
          sortOrder: w.sortOrder,
        };
      const tw = existingWeight
        ? await prisma.categoryTemplateWeight.update({
            where: { id: existingWeight.id },
            data: { sortOrder: w.sortOrder },
          })
        : await prisma.categoryTemplateWeight.create({ data: dataForWeight });
      const key = catKey(g.sex, g.ageGroupKey, w.weightKey);
      templateWeightId.set(key, tw.id);
      weightNameByCat.set(key, w.name);
      ageGroupCodeByCat.set(key, g.code);
    }
  }
  console.log(
    `✓ Category template: ${data.categoryTemplate.ageGroups.length} age groups, ${templateWeightId.size} weights`,
  );

  // 4b. Category Options library (drives the admin Category Options page).
  // Built from the same event categories — NO SYSTEM_BUILT_IN library.
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  for (const g of data.categoryTemplate.ageGroups) {
    const groupCode = `imp-${sanitize(g.code)}`;
    const group = await prisma.categoryOptionGroup.upsert({
      where: { code: groupCode },
      update: {
        name: g.name,
        nameKa: g.nameKa,
        sex: g.sex as AthleteSex,
        minAge: g.minAge,
        maxAge: g.maxAge,
        roundDurationSeconds: g.roundDurationSeconds,
        sortOrder: g.sortOrder,
        isActive: true,
      },
      create: {
        code: groupCode,
        name: g.name,
        nameKa: g.nameKa,
        sex: g.sex as AthleteSex,
        minAge: g.minAge,
        maxAge: g.maxAge,
        roundDurationSeconds: g.roundDurationSeconds,
        sortOrder: g.sortOrder,
        isActive: true,
      },
    });
    for (const w of g.weights) {
      const optionCode = `${groupCode}-${sanitize(w.weightKey)}`;
      await prisma.categoryOption.upsert({
        where: { code: optionCode },
        update: {
          name: w.name,
          minWeightKgExcl: w.minWeightKgExcl,
          maxWeightKgIncl: w.maxWeightKgIncl,
          sortOrder: w.sortOrder,
          isActive: true,
        },
        create: {
          groupId: group.id,
          code: optionCode,
          name: w.name,
          minWeightKgExcl: w.minWeightKgExcl,
          maxWeightKgIncl: w.maxWeightKgIncl,
          sortOrder: w.sortOrder,
          isActive: true,
        },
      });
    }
  }
  console.log(`✓ Category options: ${data.categoryTemplate.ageGroups.length} groups`);

  // Native bracket categoryCode, mirroring draw.service.toBracketCategoryCode.
  const bracketCode = (catK: string, ewcId: string) => {
    const age = (ageGroupCodeByCat.get(catK) ?? '').trim().toUpperCase();
    const sex = catK.split('|')[0];
    const div = sex === 'FEMALE' ? 'F' : sex === 'MALE' ? 'M' : 'X';
    const weight = (weightNameByCat.get(catK) ?? '').trim().replace(/\s+/g, '_').toUpperCase();
    return `${age}_${div}_${weight}_${ewcId}`;
  };

  // 5. Coaches (roster entities + linked login accounts) ------------------
  const coachPasswordHash = await bcrypt.hash(COACH_PASSWORD, 10);
  const coachId = new Map<string, string>(); // coachKey -> Coach.id
  for (const co of data.coaches) {
    const [cFirst, ...cRest] = co.displayName.split(/\s+/);
    const lastName = cRest.join(' ');
    const kaParts = (co.displayNameKa ?? '').split(/\s+/).filter(Boolean);
    const cClubId = co.clubKey ? clubId.get(co.clubKey) ?? null : null;
    const cCityId = cityId.get(co.cityKey) ?? null;
    const cCountryId = countryId.get(co.countryCode) ?? null;

    const user = await prisma.user.upsert({
      where: { organisationId_email: { organisationId: org.id, email: co.email } },
      update: {},
      create: {
        organisationId: org.id,
        email: co.email,
        displayName: co.displayName,
        passwordHash: coachPasswordHash,
        role: 'coach',
        clubId: cClubId,
        cityId: cCityId,
        countryId: cCountryId,
        nationality: co.nationality,
      },
    });
    const dataForCoach = {
        organisationId: org.id,
        firstName: cFirst ?? co.displayName,
        firstNameKa: kaParts[0] ?? null,
        lastName: lastName || '',
        lastNameKa: kaParts.slice(1).join(' ') || null,
        nationality: co.nationality,
        clubId: cClubId,
        cityId: cCityId,
        countryId: cCountryId,
        userId: user.id,
      };
    const coach = await prisma.coach.upsert({
      where: { userId: user.id },
      update: {
        firstName: dataForCoach.firstName,
        firstNameKa: dataForCoach.firstNameKa,
        lastName: dataForCoach.lastName,
        lastNameKa: dataForCoach.lastNameKa,
        nationality: dataForCoach.nationality,
        clubId: dataForCoach.clubId,
        cityId: dataForCoach.cityId,
        countryId: dataForCoach.countryId,
      },
      create: dataForCoach,
    });
    coachId.set(co.key, coach.id);
  }
  console.log(`✓ Coaches: ${data.coaches.length} (login password: ${COACH_PASSWORD})`);

  // 6. Athletes (with many-to-many coach links) ---------------------------
  const athleteId = new Map<string, string>();
  for (const a of data.athletes) {
    const dataForAthlete = {
        organisationId: org.id,
        clubId: a.clubKey ? clubId.get(a.clubKey) ?? null : null,
        countryId: countryId.get(a.countryCode) ?? null,
        cityId: cityId.get(a.cityKey) ?? null,
        firstName: a.firstName,
        firstNameKa: a.firstNameKa,
        lastName: a.lastName,
        lastNameKa: a.lastNameKa,
        dateOfBirth: D(a.dateOfBirth),
        documentId: a.documentId,
        sex: a.sex as AthleteSex,
      };
    const at = await prisma.athlete.upsert({
      where: {
        organisationId_documentId: {
          organisationId: org.id,
          documentId: a.documentId,
        },
      },
      update: {
        clubId: dataForAthlete.clubId,
        countryId: dataForAthlete.countryId,
        cityId: dataForAthlete.cityId,
        firstName: dataForAthlete.firstName,
        firstNameKa: dataForAthlete.firstNameKa,
        lastName: dataForAthlete.lastName,
        lastNameKa: dataForAthlete.lastNameKa,
        dateOfBirth: dataForAthlete.dateOfBirth,
        sex: dataForAthlete.sex,
      },
      create: dataForAthlete,
    });
    athleteId.set(a.key, at.id);

    const primaryClubId = a.clubKey ? clubId.get(a.clubKey) ?? null : null;
    if (primaryClubId) {
      await prisma.athleteClub.createMany({
        data: [{ athleteId: at.id, clubId: primaryClubId }],
        skipDuplicates: true,
      });
    }

    const links = [
      ...new Set(
        (a.coachKeys ?? [])
          .map((k: string) => coachId.get(k))
          .filter((x): x is string => Boolean(x)),
      ),
    ];
    if (links.length) {
      await prisma.athleteCoach.createMany({
        data: links.map((cid) => ({ athleteId: at.id, coachId: cid })),
        skipDuplicates: true,
      });
    }
  }
  console.log(`✓ Athletes: ${data.athletes.length}`);

  // 6. Admin user ---------------------------------------------------------
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { organisationId_email: { organisationId: org.id, email: ADMIN_EMAIL } },
    update: {},
    create: {
      organisationId: org.id,
      email: ADMIN_EMAIL,
      displayName: 'Administrator',
      passwordHash,
      role: 'admin',
    },
  });
  console.log(`✓ Admin user: ${ADMIN_EMAIL}`);

  // 7. Events -------------------------------------------------------------
  for (const ev of data.events) {
    const exists = await prisma.event.findUnique({
      where: { organisationId_slug: { organisationId: org.id, slug: ev.slug } },
    });
    if (exists) {
      console.log(`• Event "${ev.name}" already exists — skipping`);
      continue;
    }

    const fightDays: string[] = [];
    for (
      let d = new Date(D(ev.competitionStartDate));
      d <= D(ev.competitionEndDate);
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      fightDays.push(d.toISOString().slice(0, 10));
    }

    const event = await prisma.event.create({
      data: {
        organisationId: org.id,
        name: ev.name,
        nameKa: ev.nameKa,
        slug: ev.slug,
        location: ev.location,
        timezone: ev.timezone,
        lifecycle: 'COMPLETED',
        published: true,
        weighInResultsPublic: true,
        registrationStartDate: D(ev.registrationStartDate),
        registrationEndDate: D(ev.registrationEndDate),
        weighInStartDate: D(ev.weighInStartDate),
        weighInEndDate: D(ev.weighInEndDate),
        competitionStartDate: D(ev.competitionStartDate),
        competitionEndDate: D(ev.competitionEndDate),
        registrationOpensAt: D(ev.registrationStartDate),
        registrationClosesAt: D(ev.registrationEndDate),
        dates: {
          range: { startDate: ev.competitionStartDate, endDate: ev.competitionEndDate },
          registrationDays: [ev.weighInStartDate],
          fightDays,
        },
      },
    });

    // 7a. Event categories used by this event (regs + fights) -------------
    const usedAgeGroupCodes = new Set<string>();
    const usedCats = new Set<string>(); // catKey
    const parseCatKey = (k: string) => {
      const [sex, age] = k.split('|');
      return { sex, agCode: `${sex}_${age}` };
    };
    for (const r of ev.registrations) {
      for (const k of [r.finalCategoryKey, r.registeredCategoryKey]) {
        if (!k) continue;
        usedCats.add(k);
        usedAgeGroupCodes.add(parseCatKey(k).agCode);
      }
    }
    for (const f of ev.fights) {
      usedCats.add(f.categoryKey);
      usedAgeGroupCodes.add(parseCatKey(f.categoryKey).agCode);
    }

    const eventAgeGroupId = new Map<string, string>(); // agCode -> id
    for (const agCode of usedAgeGroupCodes) {
      const eag = await prisma.eventAgeGroup.create({
        data: {
          eventId: event.id,
          categoryTemplateAgeGroupId: templateAgeGroupId.get(agCode)!,
        },
      });
      eventAgeGroupId.set(agCode, eag.id);
    }
    const eventWeightCategoryId = new Map<string, string>(); // catKey -> id
    for (const k of usedCats) {
      const { agCode } = parseCatKey(k);
      const ewc = await prisma.eventWeightCategory.create({
        data: {
          eventAgeGroupId: eventAgeGroupId.get(agCode)!,
          categoryTemplateWeightId: templateWeightId.get(k)!,
        },
      });
      eventWeightCategoryId.set(k, ewc.id);
    }

    // 7b. Registrations ---------------------------------------------------
    const regIdByAthlete = new Map<string, string>();
    for (const r of ev.registrations) {
      const competing = r.status === 'APPROVED';
      // Native convention: categoryCode = human-readable weight name.
      const displayCat =
        (r.finalCategoryKey && weightNameByCat.get(r.finalCategoryKey)) ||
        (r.registeredCategoryKey && weightNameByCat.get(r.registeredCategoryKey)) ||
        '—';
      const reg = await prisma.registration.create({
        data: {
          organisationId: org.id,
          eventId: event.id,
          athleteId: athleteId.get(r.athleteKey)!,
          clubId: r.clubKey ? clubId.get(r.clubKey) ?? null : null,
          categoryCode: displayCat,
          eventWeightCategoryId: r.finalCategoryKey
            ? eventWeightCategoryId.get(r.finalCategoryKey) ?? null
            : null,
          registeredEventWeightCategoryId: r.registeredCategoryKey
            ? eventWeightCategoryId.get(r.registeredCategoryKey) ?? null
            : null,
          status: r.status as any,
          weighInStatus: competing ? 'PASSED' : 'NOT_WEIGHED',
        },
      });
      regIdByAthlete.set(r.athleteKey, reg.id);
    }

    // 7c. Weigh-in attempts (competing only) ------------------------------
    let weighCount = 0;
    for (const w of ev.weighIns) {
      const regId = regIdByAthlete.get(w.athleteKey);
      if (!regId || !w.competing) continue;
      await prisma.weighInAttempt.create({
        data: {
          organisationId: org.id,
          eventId: event.id,
          registrationId: regId,
          attemptNo: 1,
          weightKg: w.weightKg,
          decision: 'PASS',
        },
      });
      weighCount++;
    }

    // 7d. Brackets + confirmed fights ------------------------------------
    const byCat = new Map<string, typeof ev.fights>();
    for (const f of ev.fights) {
      const arr = byCat.get(f.categoryKey) ?? [];
      arr.push(f);
      byCat.set(f.categoryKey, arr);
    }
    let bracketCount = 0;
    let fightCount = 0;
    for (const [cKey, catFights] of byCat) {
      const athletes = new Set<string>();
      for (const f of catFights) {
        athletes.add(f.redAthleteKey);
        if (f.blueAthleteKey) athletes.add(f.blueAthleteKey); // byes have no blue
      }
      const n = athletes.size;
      const format: BracketFormat =
        n <= 2 ? 'DIRECT_FINAL' : n === 3 ? 'ROUND_ROBIN' : 'SINGLE_ELIMINATION';
      const ewcId = eventWeightCategoryId.get(cKey) ?? null;
      const code = ewcId ? bracketCode(cKey, ewcId) : cKey;
      const bracket = await prisma.bracket.create({
        data: {
          organisationId: org.id,
          eventId: event.id,
          categoryCode: code,
          format,
        },
      });
      bracketCount++;
      const { agCode } = parseCatKey(cKey);
      const roundSecs =
        data.categoryTemplate.ageGroups.find((g) => g.code === agCode)
          ?.roundDurationSeconds ?? 120;
      for (const f of catFights) {
        await prisma.fight.create({
          data: {
            organisationId: org.id,
            eventId: event.id,
            bracketId: bracket.id,
            categoryCode: code,
            eventWeightCategoryId: ewcId,
            roundDurationSeconds: roundSecs,
            round: f.round,
            boutNo: f.boutNo,
            redAthleteId: athleteId.get(f.redAthleteKey) ?? null,
            blueAthleteId: f.blueAthleteKey ? athleteId.get(f.blueAthleteKey) ?? null : null,
            status: 'CONFIRMED',
            winnerAthleteId: f.winnerAthleteKey ? athleteId.get(f.winnerAthleteKey) ?? null : null,
            // Byes have no loser; otherwise the loser is whichever side didn't win.
            loserAthleteId:
              f.winnerAthleteKey && f.blueAthleteKey
                ? athleteId.get(
                    f.winnerAthleteKey === f.redAthleteKey
                      ? f.blueAthleteKey
                      : f.redAthleteKey,
                  ) ?? null
                : null,
            winMethod: ((f as { winMethod?: string }).winMethod as WinMethod) ?? 'POINTS',
            confirmedAt: D(ev.competitionEndDate),
          },
        });
        fightCount++;
      }
    }

    console.log(
      `✓ Event "${ev.name}": ${ev.registrations.length} regs, ${weighCount} weigh-ins, ${bracketCount} brackets, ${fightCount} fights`,
    );
  }

  console.log('\nImport seed complete.');
  console.log(`  Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Coach logins: <name>@coach.gwf.ge / ${COACH_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
