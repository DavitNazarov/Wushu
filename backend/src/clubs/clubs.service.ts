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
}
