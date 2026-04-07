import { Injectable } from '@nestjs/common';
import type { Club, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organisationId: string): Promise<Club[]> {
    return this.prisma.club.findMany({
      where: { organisationId },
      orderBy: [{ name: 'asc' }],
    });
  }

  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    name: string;
    city?: string | null;
    country?: string | null;
  }): Promise<Club> {
    const existing = input.id
      ? await this.prisma.club.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.ClubUncheckedCreateInput = {
      organisationId: input.organisationId,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      country: input.country?.trim() || null,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.club.update({
            where: { id: existing.id },
            data,
          })
        : await tx.club.create({ data });

      await this.audit.write({
        organisationId: input.organisationId,
        actorUserId: input.actorUserId,
        action: existing ? 'CLUB_UPDATED' : 'CLUB_CREATED',
        entityType: 'club',
        entityId: saved.id,
        before: existing as unknown as Prisma.JsonValue | null,
        after: saved as unknown as Prisma.JsonValue,
        reason: null,
        ipAddress: null,
      });

      return saved;
    });
  }

  async listPublic(): Promise<Club[]> {
    const org = await this.prisma.organisation.findFirst();
    if (!org) return [];

    return this.prisma.club.findMany({
      where: { organisationId: org.id },
      orderBy: [{ name: 'asc' }],
    });
  }

  async getPublicDetails(clubId: string) {
    const org = await this.prisma.organisation.findFirst();
    if (!org) return null;

    const club = await this.prisma.club.findFirst({
      where: { id: clubId, organisationId: org.id },
    });
    if (!club) return null;

    const coaches = await this.prisma.user.findMany({
      where: { clubId: club.id, role: 'coach' },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });

    const athletes = await this.prisma.athlete.findMany({
      where: { clubId: club.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
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
        city: club.city,
        country: club.country,
      },
      coaches: coaches.map((c) => ({
        id: c.id,
        displayName: c.displayName,
      })),
      athletes: athletes.map((a) => {
        const reg = a.registrations[0];
        const weightName = reg?.eventWeightCategory?.categoryTemplateWeight?.name ?? null;
        const ageName = reg?.eventWeightCategory?.eventAgeGroup?.categoryTemplateAgeGroup?.name ?? null;
        const category = [ageName, weightName].filter(Boolean).join(' · ') || null;
        return {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
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
