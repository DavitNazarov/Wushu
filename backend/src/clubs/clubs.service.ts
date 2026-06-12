import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Club, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolvePublicOrg } from '../common/public-org';

// Club CRUD + public-facing club page assembly. The "public" methods
// (listPublic, getPublicDetails) intentionally don't take an organisationId —
// they resolve "the" public org via resolvePublicOrg(), used by the
// unauthenticated public site which has no tenant context.
@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Admin/coach club list, alphabetical by EN name. Region + country are
  // required relations, so they're always present; `country` is exposed as the
  // country NAME (back-compat with the old free-text field) alongside the
  // structured region/country ids + Georgian names.
  async list(organisationId: string) {
    const rows = await this.prisma.club.findMany({
      where: { organisationId },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameKa: true,
        city: true,
        regionId: true,
        countryId: true,
        region: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      nameKa: c.nameKa,
      city: c.city,
      regionId: c.regionId,
      regionName: c.region.name,
      regionNameKa: c.region.nameKa,
      countryId: c.countryId,
      country: c.country.name,
      countryNameKa: c.country.nameKa,
    }));
  }

  // Create-or-update a club. If input.id matches a club in this org, updates
  // it; otherwise creates a new row. regionId is required; the club's countryId
  // is derived from the chosen region (validated to be in this org). When an
  // existing club's region/country changes, the denormalised regionId/countryId
  // on its coaches + athletes are cascaded in the same transaction so they
  // never drift. Wrapped with the CLUB_CREATED / CLUB_UPDATED audit row.
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    name: string;
    nameKa?: string | null;
    city?: string | null;
    regionId: string;
  }): Promise<Club> {
    const region = await this.prisma.region.findFirst({
      where: { id: input.regionId, organisationId: input.organisationId },
      select: { id: true, countryId: true },
    });
    if (!region) {
      throw new HttpException(
        { code: 'REGION_NOT_FOUND', message: 'Region not found' },
        HttpStatus.NOT_FOUND,
      );
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
      city: input.city?.trim() || null,
      regionId: region.id,
      countryId: region.countryId,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.club.update({ where: { id: existing.id }, data })
        : await tx.club.create({ data });

      // Keep coaches/athletes of this club aligned with its region/country.
      if (
        existing &&
        (existing.regionId !== saved.regionId ||
          existing.countryId !== saved.countryId)
      ) {
        await tx.user.updateMany({
          where: { clubId: saved.id },
          data: { regionId: saved.regionId, countryId: saved.countryId },
        });
        await tx.athlete.updateMany({
          where: { clubId: saved.id },
          data: { regionId: saved.regionId, countryId: saved.countryId },
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
  // none exists yet, returns an empty array rather than throwing — that way
  // the public homepage gracefully shows "no clubs" instead of a 500.
  async listPublic(): Promise<Club[]> {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

    return this.prisma.club.findMany({
      where: { organisationId: org.id },
      orderBy: [{ name: 'asc' }],
    });
  }

  // Build the unauthenticated /clubs/:id detail payload: club header + coach
  // list + athlete roster (with the latest registration's category as a
  // human-readable string). For each athlete we only pull their most-recent
  // registration (take: 1) — enough to display a category tag without
  // exposing their full event history.
  //
  // Per-athlete `name`/`nameKa` are pre-joined into a single string for
  // the UI's bilingual selector. `category` collapses "AgeGroup · WeightClass"
  // into one display label.
  async getPublicDetails(clubId: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return null;

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, organisationId: org.id },
      select: {
        id: true,
        name: true,
        nameKa: true,
        city: true,
        region: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
      },
    });
    if (!club) return null;

    const coaches = await this.prisma.user.findMany({
      where: { organisationId: org.id, clubId: club.id, role: 'coach' },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });

    const athletes = await this.prisma.athlete.findMany({
      where: { organisationId: org.id, clubId: club.id },
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

    return {
      club: {
        id: club.id,
        name: club.name,
        nameKa: club.nameKa ?? null,
        city: club.city,
        country: club.country.name,
        countryNameKa: club.country.nameKa,
        regionName: club.region.name,
        regionNameKa: club.region.nameKa,
      },
      coaches: coaches.map((c) => ({
        id: c.id,
        displayName: c.displayName,
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
}
