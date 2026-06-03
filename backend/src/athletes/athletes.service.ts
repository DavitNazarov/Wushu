import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Athlete, AthleteSex, Club } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

// Filter shape for AthletesService.list(). All fields are optional and
// combined with AND (the search field itself widens to lastName/firstName/
// documentId via an inner OR — see list() below).
export type AthleteFilters = {
  search?: string;
  clubId?: string;
  dateOfBirth?: Date;
  documentId?: string;
};

// Row shape returned to the admin/coach UI. `duplicateCount` is computed at
// query time so the UI can show a "looks like a duplicate" pill without a
// second roundtrip.
export type AthleteWithDuplicates = Athlete & {
  duplicateCount: number;
  club: Pick<Club, 'id' | 'name' | 'city' | 'country'> | null;
};

// Admin + coach writes for the Athlete table. The athlete profile page (read)
// lives in AthleteProfileService — this service is intentionally mutation-only.
@Injectable()
export class AthletesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Indexed athlete list for the admin/coach athletes page. After the DB
  // query we walk the result once to compute duplicateCount per row using
  // the same key shape as the @@unique-ish duplicate signature
  // (org + dateOfBirth + documentId, case-insensitive on docId).
  // search matches lastName OR firstName OR documentId, case-insensitive.
  async list(
    organisationId: string,
    filters: AthleteFilters = {},
  ): Promise<AthleteWithDuplicates[]> {
    const where: Prisma.AthleteWhereInput = { organisationId };

    if (filters.clubId) where.clubId = filters.clubId;
    if (filters.dateOfBirth) where.dateOfBirth = filters.dateOfBirth;
    if (filters.documentId) where.documentId = filters.documentId;

    if (filters.search?.trim()) {
      const search = filters.search.trim();
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { documentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const athletes = await this.prisma.athlete.findMany({
      where,
      include: {
        club: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
        { dateOfBirth: 'asc' },
      ],
    });

    if (athletes.length === 0) return [];

    const duplicateMap = new Map<string, number>();
    for (const a of athletes) {
      const key = this.getDuplicateKey(a);
      duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
    }

    return athletes.map((a) => ({
      ...a,
      duplicateCount: duplicateMap.get(this.getDuplicateKey(a)) ?? 0,
    }));
  }

  // Upsert (id present → update, missing → create) with these checks, in order:
  //   1. If clubId provided, it must exist in this org (else INVALID_CLUB 400).
  //   2. For coaches (actorClubId set), the existing row's club must match
  //      their clubId — otherwise ATHLETE_NOT_IN_COACH_CLUB.
  //   3. documentId must be unique in the org (excluding self on update).
  //      We do both a pre-check (DOCUMENT_ID_ALREADY_EXISTS) and rely on
  //      the @@unique([organisationId, documentId]) Prisma index as a safety
  //      net for the small race window between check and write.
  // After the write, compute possibleDuplicates so the UI can offer a "merge?"
  // prompt for newly-created or recently-edited athletes.
  async createOrUpdate(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    clubId?: string | null;
    actorClubId?: string | null;
    firstName: string;
    firstNameKa?: string | null;
    lastName: string;
    lastNameKa?: string | null;
    dateOfBirth: Date;
    documentId: string;
    sex?: AthleteSex | null;
  }): Promise<{ athlete: Athlete; possibleDuplicates: Athlete[] }> {
    if (input.clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: input.clubId, organisationId: input.organisationId },
      });

      if (!club) {
        throw new HttpException(
          {
            code: 'INVALID_CLUB',
            message: 'clubId not found for organisation',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const existing = input.id
      ? await this.prisma.athlete.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    // Coach can only update athletes in their club
    if (
      input.actorClubId &&
      existing &&
      existing.clubId !== input.actorClubId
    ) {
      throw new Error('ATHLETE_NOT_IN_COACH_CLUB');
    }

    const documentId = input.documentId.trim();

    // Check documentId uniqueness within organisation (excluding self on update)
    const conflictingAthlete = await this.prisma.athlete.findFirst({
      where: {
        organisationId: input.organisationId,
        documentId,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      select: { id: true },
    });
    if (conflictingAthlete) {
      throw new Error('DOCUMENT_ID_ALREADY_EXISTS');
    }

    const data: Prisma.AthleteUncheckedCreateInput = {
      organisationId: input.organisationId,
      clubId: input.clubId ?? null,
      firstName: input.firstName.trim(),
      firstNameKa: input.firstNameKa?.trim() || null,
      lastName: input.lastName.trim(),
      lastNameKa: input.lastNameKa?.trim() || null,
      dateOfBirth: input.dateOfBirth,
      documentId,
      sex: input.sex ?? null,
    };

    const possibleDuplicates = await this.findPossibleDuplicates({
      organisationId: input.organisationId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      documentId,
      excludeId: existing?.id,
    });

    let athlete: Athlete;
    try {
      athlete = await this.prisma.$transaction(async (tx) => {
        const saved = existing
          ? await tx.athlete.update({ where: { id: existing.id }, data })
          : await tx.athlete.create({ data });

        await this.audit.write({
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'ATHLETE_UPDATED' : 'ATHLETE_CREATED',
          entityType: 'athlete',
          entityId: saved.id,
          before: existing as unknown as Prisma.JsonValue | null,
          after: saved as unknown as Prisma.JsonValue,
        });

        return saved;
      });
    } catch (e) {
      // The findFirst above is racy — a concurrent insert may slip through and
      // hit the @@unique([organisationId, documentId]) constraint instead.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new Error('DOCUMENT_ID_ALREADY_EXISTS');
      }
      throw e;
    }

    return { athlete, possibleDuplicates };
  }

  // Merge two athlete records into one. primaryId is kept, secondaryId is
  // deleted. All FK references (registrations, fights as red/blue/winner/loser)
  // are redirected to primaryId via updateMany, then the secondary is removed.
  // The merged primary row is "filled in" from the secondary for any null
  // fields (e.g. picks up secondary.clubId if primary had none).
  // Also writes an AthleteMerge row + audit log for traceability.
  async merge(input: {
    organisationId: string;
    actorUserId: string;
    actorClubId?: string | null;
    primaryId: string;
    secondaryId: string;
    reason: string;
  }): Promise<Athlete> {
    if (input.primaryId === input.secondaryId)
      throw new Error('MERGE_IDS_MUST_DIFFER');

    const [primary, secondary] = await Promise.all([
      this.prisma.athlete.findFirst({
        where: { id: input.primaryId, organisationId: input.organisationId },
      }),
      this.prisma.athlete.findFirst({
        where: { id: input.secondaryId, organisationId: input.organisationId },
      }),
    ]);

    if (!primary || !secondary) throw new Error('ATHLETE_NOT_FOUND');
    if (
      input.actorClubId &&
      (primary.clubId !== input.actorClubId ||
        secondary.clubId !== input.actorClubId)
    ) {
      throw new Error('ATHLETE_NOT_IN_COACH_CLUB');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.registration.updateMany({
        where: { athleteId: input.secondaryId },
        data: { athleteId: input.primaryId },
      });

      await tx.fight.updateMany({
        where: { redAthleteId: input.secondaryId },
        data: { redAthleteId: input.primaryId },
      });

      await tx.fight.updateMany({
        where: { blueAthleteId: input.secondaryId },
        data: { blueAthleteId: input.primaryId },
      });

      await tx.fight.updateMany({
        where: { winnerAthleteId: input.secondaryId },
        data: { winnerAthleteId: input.primaryId },
      });

      await tx.fight.updateMany({
        where: { loserAthleteId: input.secondaryId },
        data: { loserAthleteId: input.primaryId },
      });

      const merged = await tx.athlete.update({
        where: { id: primary.id },
        data: {
          clubId: primary.clubId ?? secondary.clubId,
          firstName: primary.firstName || secondary.firstName,
          lastName: primary.lastName || secondary.lastName,
          dateOfBirth: primary.dateOfBirth || secondary.dateOfBirth,
          documentId: primary.documentId ?? secondary.documentId,
          sex: primary.sex ?? secondary.sex,
        },
      });

      await tx.athlete.delete({ where: { id: secondary.id } });

      await tx.athleteMerge.create({
        data: {
          organisationId: input.organisationId,
          primaryAthleteId: input.primaryId,
          secondaryAthleteId: input.secondaryId,
          reason: input.reason,
          mergedByUserId: input.actorUserId,
        },
      });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: 'ATHLETE_MERGED',
        entityType: 'athlete',
        entityId: merged.id,
        before: { primary, secondary } as unknown as Prisma.JsonValue,
        after: merged as unknown as Prisma.JsonValue,
        reason: input.reason,
      });

      return merged;
    });
  }

  // Stable signature for "looks like the same person": org + DOB + lowercase
  // documentId. Used by list() to count duplicates per row. Lowercasing the
  // documentId keeps passport-case noise from breaking the grouping.
  private getDuplicateKey(athlete: Athlete): string {
    return `${athlete.organisationId}:${athlete.dateOfBirth.toISOString()}:${athlete.documentId.toLowerCase()}`;
  }

  // Surfaces "candidate duplicates" for the create/update UI. Matches on
  //   - same DOB AND (firstName+lastName case-insensitive match), OR
  //   - same DOB AND documentId case-insensitive match
  // The DOB filter is intentional — without it we'd surface every "John Smith"
  // in the system, which is noise.
  private async findPossibleDuplicates(input: {
    organisationId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | string;
    documentId: string;
    excludeId?: string;
  }): Promise<Athlete[]> {
    const andConditions: Prisma.AthleteWhereInput[] = [];
    if (input.excludeId) andConditions.push({ id: { not: input.excludeId } });

    const where: Prisma.AthleteWhereInput = {
      organisationId: input.organisationId,
      dateOfBirth: input.dateOfBirth,
      AND: andConditions.length > 0 ? andConditions : undefined,
      OR: [
        {
          lastName: { equals: input.lastName, mode: 'insensitive' },
          firstName: { equals: input.firstName, mode: 'insensitive' },
        },
        { documentId: { equals: input.documentId, mode: 'insensitive' } },
      ],
    };

    return this.prisma.athlete.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
