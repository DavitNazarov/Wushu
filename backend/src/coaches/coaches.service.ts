import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

// Coach CRUD — sits between Club and Athlete (Club → Coach → Athlete). A coach
// belongs to a club; city/country are denormalised from the club. Athletes link
// to coaches many-to-many via AthleteCoach. Org-scoped; writes admin-only.
@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string, clubId?: string) {
    const rows = await this.prisma.coach.findMany({
      where: { organisationId, ...(clubId ? { clubId } : {}) },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        firstNameKa: true,
        lastName: true,
        lastNameKa: true,
        nationality: true,
        clubId: true,
        cityId: true,
        countryId: true,
        club: { select: { name: true, nameKa: true } },
        city: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
        user: { select: { id: true, email: true } },
        _count: { select: { athletes: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      firstNameKa: c.firstNameKa,
      lastName: c.lastName,
      lastNameKa: c.lastNameKa,
      nationality: c.nationality,
      clubId: c.clubId,
      clubName: c.club?.name ?? null,
      clubNameKa: c.club?.nameKa ?? null,
      cityId: c.cityId,
      cityName: c.city?.name ?? null,
      countryId: c.countryId,
      countryName: c.country?.name ?? null,
      userId: c.user?.id ?? null,
      userEmail: c.user?.email ?? null,
      athleteCount: c._count.athletes,
    }));
  }

  // Create-or-update. city/country are derived from the chosen club (if any).
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    firstName: string;
    firstNameKa?: string | null;
    lastName: string;
    lastNameKa?: string | null;
    nationality?: string | null;
    clubId?: string | null;
  }) {
    let cityId: string | null = null;
    let countryId: string | null = null;
    if (input.clubId) {
      const club = await this.prisma.club.findFirst({
        where: { id: input.clubId, organisationId: input.organisationId },
        select: { id: true, cityId: true, countryId: true },
      });
      if (!club) {
        throw new HttpException(
          { code: 'CLUB_NOT_FOUND', message: 'Club not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      cityId = club.cityId;
      countryId = club.countryId;
    }

    const existing = input.id
      ? await this.prisma.coach.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.CoachUncheckedCreateInput = {
      organisationId: input.organisationId,
      firstName: input.firstName.trim(),
      firstNameKa: input.firstNameKa?.trim() || null,
      lastName: input.lastName.trim(),
      lastNameKa: input.lastNameKa?.trim() || null,
      nationality: input.nationality?.trim() || null,
      clubId: input.clubId ?? null,
      cityId,
      countryId,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.coach.update({ where: { id: existing.id }, data })
        : await tx.coach.create({ data });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'COACH_UPDATED' : 'COACH_CREATED',
          entityType: 'coach',
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

  // Delete — AthleteCoach links cascade away (onDelete: Cascade in the schema).
  async remove(organisationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.coach.findFirst({
      where: { id, organisationId },
      select: { id: true },
    });
    if (!existing) {
      throw new HttpException(
        { code: 'COACH_NOT_FOUND', message: 'Coach not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.coach.delete({ where: { id } });
      await this.audit.write(
        {
          organisationId,
          actorUserId,
          action: 'COACH_DELETED',
          entityType: 'coach',
          entityId: id,
          before: null,
          after: null,
          reason: null,
          ipAddress: null,
        },
        tx,
      );
    });
  }
}
