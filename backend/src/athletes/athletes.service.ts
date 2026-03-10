import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Athlete, AthleteSex, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

export type AthleteFilters = {
  search?: string;
  clubId?: string;
  dateOfBirth?: Date;
  documentId?: string;
};

export type AthleteWithDuplicates = Athlete & { duplicateCount: number };

@Injectable()
export class AthletesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
      if (key) duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
    }

    return athletes.map((a) => ({
      ...a,
      duplicateCount: duplicateMap.get(this.getDuplicateKey(a) ?? '') ?? 0,
    }));
  }

  async createOrUpdate(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    clubId?: string | null;
    actorClubId?: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    documentId?: string | null;
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

    const data: Prisma.AthleteUncheckedCreateInput = {
      organisationId: input.organisationId,
      clubId: input.clubId ?? null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      dateOfBirth: input.dateOfBirth,
      documentId: input.documentId?.trim() || null,
      sex: input.sex ?? null,
    };

    const possibleDuplicates = await this.findPossibleDuplicates({
      organisationId: input.organisationId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      documentId: data.documentId ?? undefined,
      excludeId: existing?.id,
    });

    const athlete = await this.prisma.$transaction(async (tx) => {
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

    return { athlete, possibleDuplicates };
  }

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

  private getDuplicateKey(athlete: Athlete): string | null {
    if (!athlete.dateOfBirth || !athlete.documentId) return null;
    return `${athlete.organisationId}:${athlete.dateOfBirth.toISOString()}:${athlete.documentId.toLowerCase()}`;
  }

  private async findPossibleDuplicates(input: {
    organisationId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | string;
    documentId?: string;
    excludeId?: string;
  }): Promise<Athlete[]> {
    const andConditions: Prisma.AthleteWhereInput[] = [];
    if (input.excludeId) andConditions.push({ id: { not: input.excludeId } });

    const nameFilter: Prisma.AthleteWhereInput = {
      lastName: { equals: input.lastName, mode: 'insensitive' },
      firstName: { equals: input.firstName, mode: 'insensitive' },
    };

    const docFilter: Prisma.AthleteWhereInput | null = input.documentId
      ? { documentId: { equals: input.documentId, mode: 'insensitive' } }
      : null;

    const where: Prisma.AthleteWhereInput = {
      organisationId: input.organisationId,
      dateOfBirth: input.dateOfBirth,
      AND: andConditions.length > 0 ? andConditions : undefined,
      ...(docFilter ? { OR: [nameFilter, docFilter] } : nameFilter),
    };

    return this.prisma.athlete.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
}
