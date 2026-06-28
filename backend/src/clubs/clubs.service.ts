import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Club, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolvePublicOrg } from '../common/public-org';
import {
  computeCategoryResults,
  type CompetitionFight,
} from '../competition/competition.logic';

// A club's career podium tally, aggregated across every decided category in
// published events. Each medal is an athlete-level result credited to the
// medalist's *current* club. `total` is gold + silver + bronze.
export type ClubMedalTally = {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
};

// Internal-only zero tally; not exported (no external consumer).
const EMPTY_CLUB_MEDALS: ClubMedalTally = {
  gold: 0,
  silver: 0,
  bronze: 0,
  total: 0,
};

// Club CRUD + public-facing club page assembly. A club sits in the hierarchy as
// Country → City → Federation → Club → Coach → Athlete. City + country are
// required relations; federation is optional.
@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Admin/coach club list, alphabetical by EN name, with the structured
  // city/federation/country ids + bilingual names.
  async list(organisationId: string) {
    const rows = await this.prisma.club.findMany({
      where: { organisationId },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameKa: true,
        isOfficial: true,
        cityId: true,
        federationId: true,
        countryId: true,
        city: { select: { name: true, nameKa: true } },
        federation: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      nameKa: c.nameKa,
      isOfficial: c.isOfficial,
      cityId: c.cityId,
      cityName: c.city.name,
      cityNameKa: c.city.nameKa,
      federationId: c.federationId,
      federationName: c.federation?.name ?? null,
      federationNameKa: c.federation?.nameKa ?? null,
      countryId: c.countryId,
      country: c.country.name,
      countryNameKa: c.country.nameKa,
    }));
  }

  // Create-or-update a club. cityId is required; countryId is derived from the
  // chosen city (validated to be in this org). federationId is optional and, if
  // given, must belong to the same city. When an existing club's city/country
  // changes, the denormalised cityId/countryId on its coaches + athletes are
  // cascaded in the same transaction so they never drift.
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    name: string;
    nameKa?: string | null;
    cityId: string;
    federationId?: string | null;
    isOfficial: boolean;
  }): Promise<Club> {
    const city = await this.prisma.city.findFirst({
      where: { id: input.cityId, organisationId: input.organisationId },
      select: { id: true, countryId: true },
    });
    if (!city) {
      throw new HttpException(
        { code: 'CITY_NOT_FOUND', message: 'City not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    let federationId: string | null = null;
    if (input.federationId) {
      const federation = await this.prisma.federation.findFirst({
        where: { id: input.federationId, organisationId: input.organisationId },
        select: { id: true, cityId: true },
      });
      if (!federation) {
        throw new HttpException(
          { code: 'FEDERATION_NOT_FOUND', message: 'Federation not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (federation.cityId !== city.id) {
        throw new HttpException(
          {
            code: 'FEDERATION_CITY_MISMATCH',
            message: 'Federation belongs to a different city',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      federationId = federation.id;
    }

    const existing = input.id
      ? await this.prisma.club.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.ClubUncheckedCreateInput = {
      organisationId: input.organisationId,
      name: input.name.trim(),
      nameKa: input.nameKa?.trim() || null,
      isOfficial: input.isOfficial,
      cityId: city.id,
      federationId,
      countryId: city.countryId,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.club.update({ where: { id: existing.id }, data })
        : await tx.club.create({ data });

      // Keep coaches/athletes of this club aligned with its city/country.
      if (
        existing &&
        (existing.cityId !== saved.cityId ||
          existing.countryId !== saved.countryId)
      ) {
        await tx.user.updateMany({
          where: { clubId: saved.id },
          data: { cityId: saved.cityId, countryId: saved.countryId },
        });
        await tx.coach.updateMany({
          where: { clubId: saved.id },
          data: { cityId: saved.cityId, countryId: saved.countryId },
        });
        await tx.athlete.updateMany({
          where: { clubId: saved.id },
          data: { cityId: saved.cityId, countryId: saved.countryId },
        });
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'CLUB_UPDATED' : 'CLUB_CREATED',
          entityType: 'club',
          entityId: saved.id,
          before: existing as unknown as Prisma.JsonValue | null,
          after: saved as unknown as Prisma.JsonValue,
          reason: null,
          ipAddress: null,
        },
        tx,
      );

      return saved;
    });
  }

  // Public site clubs listing. Resolves the canonical public org first; if
  // none exists yet, returns an empty array rather than throwing.
  async listPublic(): Promise<Club[]> {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

    return this.prisma.club.findMany({
      where: { organisationId: org.id },
      orderBy: [{ name: 'asc' }],
    });
  }

  // Build the unauthenticated /clubs/:id detail payload: club header + coach
  // roster + athlete roster (with the latest registration's category as a
  // human-readable string).
  async getPublicDetails(clubId: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return null;

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, organisationId: org.id },
      select: {
        id: true,
        name: true,
        nameKa: true,
        city: { select: { name: true, nameKa: true } },
        federation: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
      },
    });
    if (!club) return null;

    // Coach roster = Coach entities attached to this club.
    const coaches = await this.prisma.coach.findMany({
      where: { organisationId: org.id, clubId: club.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameKa: true,
        lastNameKa: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const athletes = await this.prisma.athlete.findMany({
      where: {
        organisationId: org.id,
        OR: [
          { clubId: club.id },
          { clubMemberships: { some: { clubId: club.id } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameKa: true,
        lastNameKa: true,
        registrations: {
          select: {
            eventWeightCategoryId: true,
            eventWeightCategory: {
              select: {
                categoryTemplateWeight: { select: { name: true } },
                eventAgeGroup: {
                  select: {
                    categoryTemplateAgeGroup: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const medals =
      (await this.computeMedalsByClub(org.id)).get(club.id) ?? EMPTY_CLUB_MEDALS;

    return {
      club: {
        id: club.id,
        name: club.name,
        nameKa: club.nameKa ?? null,
        country: club.country.name,
        countryNameKa: club.country.nameKa,
        cityName: club.city.name,
        cityNameKa: club.city.nameKa,
        federationName: club.federation?.name ?? null,
        federationNameKa: club.federation?.nameKa ?? null,
      },
      medals,
      coaches: coaches.map((c) => ({
        id: c.id,
        displayName: `${c.firstName} ${c.lastName}`.trim(),
        displayNameKa:
          c.firstNameKa && c.lastNameKa
            ? `${c.firstNameKa} ${c.lastNameKa}`.trim()
            : null,
      })),
      athletes: athletes.map((a) => {
        const reg = a.registrations[0];
        const weightName =
          reg?.eventWeightCategory?.categoryTemplateWeight?.name ?? null;
        const ageName =
          reg?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup
            ?.name ?? null;
        const category =
          [ageName, weightName].filter(Boolean).join(' · ') || null;
        const hasKaFullName = Boolean(a.firstNameKa && a.lastNameKa);
        return {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          firstNameKa: a.firstNameKa ?? null,
          lastNameKa: a.lastNameKa ?? null,
          name: `${a.firstName} ${a.lastName}`,
          nameKa: hasKaFullName ? `${a.firstNameKa} ${a.lastNameKa}` : null,
          category,
        };
      }),
      stats: {
        coachCount: coaches.length,
        athleteCount: athletes.length,
      },
    };
  }

  // Aggregate podium medals (gold/silver/bronze) per club across every weight
  // category that has fights in a *published* event.
  async computeMedalsByClub(
    organisationId: string,
  ): Promise<Map<string, ClubMedalTally>> {
    const fights = await this.prisma.fight.findMany({
      where: {
        organisationId,
        event: { published: true },
      },
      select: {
        id: true,
        bracketId: true,
        eventId: true,
        categoryCode: true,
        eventWeightCategoryId: true,
        round: true,
        boutNo: true,
        status: true,
        redAthleteId: true,
        blueAthleteId: true,
        winnerAthleteId: true,
        winMethod: true,
        notes: true,
        event: { select: { bronzePolicyCode: true } },
      },
    });

    const athleteIds = new Set<string>();
    for (const f of fights) {
      if (f.redAthleteId) athleteIds.add(f.redAthleteId);
      if (f.blueAthleteId) athleteIds.add(f.blueAthleteId);
    }
    const athletes = await this.prisma.athlete.findMany({
      where: { organisationId, id: { in: [...athleteIds] } },
      select: { id: true, clubId: true },
    });
    const clubByAthlete = new Map(athletes.map((a) => [a.id, a.clubId]));

    const byBracket = new Map<
      string,
      { fights: CompetitionFight[]; bronzePolicy: 'TWO_BRONZES' }
    >();
    for (const f of fights) {
      const key =
        f.bracketId ??
        `${f.eventId}:${f.eventWeightCategoryId ?? f.categoryCode}`;
      const bucket = byBracket.get(key) ?? {
        fights: [],
        bronzePolicy: f.event.bronzePolicyCode,
      };
      bucket.fights.push({
        id: f.id,
        round: f.round,
        boutNo: f.boutNo,
        status: f.status,
        redAthleteId: f.redAthleteId ?? null,
        blueAthleteId: f.blueAthleteId ?? null,
        winnerAthleteId: f.winnerAthleteId ?? null,
        winMethod: f.winMethod ?? null,
        notes: f.notes ?? null,
      });
      byBracket.set(key, bucket);
    }

    const tally = new Map<string, ClubMedalTally>();
    const credit = (
      clubId: string | null | undefined,
      medal: 'GOLD' | 'SILVER' | 'BRONZE',
    ) => {
      if (!clubId) return;
      const row = tally.get(clubId) ?? { ...EMPTY_CLUB_MEDALS };
      if (medal === 'GOLD') row.gold += 1;
      else if (medal === 'SILVER') row.silver += 1;
      else row.bronze += 1;
      row.total += 1;
      tally.set(clubId, row);
    };

    for (const { fights: categoryFights, bronzePolicy } of byBracket.values()) {
      const results = computeCategoryResults({
        fights: categoryFights,
        bronzePolicy,
      });
      for (const placement of results.placements) {
        if (!placement.medal || !placement.athleteId) continue;
        credit(clubByAthlete.get(placement.athleteId), placement.medal);
      }
    }
    return tally;
  }
}
