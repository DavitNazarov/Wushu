import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

// Region CRUD — middle of the geography hierarchy (Country → Region → Club).
// Org-scoped; writes are admin-only (enforced in the controller) and audited.
@Injectable()
export class RegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // List regions, optionally filtered to one country (used by the club form's
  // cascading region picker). Includes the parent country name + club count.
  async list(organisationId: string, countryId?: string) {
    const rows = await this.prisma.region.findMany({
      where: { organisationId, ...(countryId ? { countryId } : {}) },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        countryId: true,
        name: true,
        nameKa: true,
        country: { select: { name: true, nameKa: true } },
        _count: { select: { clubs: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      countryId: r.countryId,
      name: r.name,
      nameKa: r.nameKa,
      countryName: r.country.name,
      countryNameKa: r.country.nameKa,
      clubCount: r._count.clubs,
    }));
  }

  // Create-or-update. Validates the target country is in the same org. If an
  // existing region is re-parented to a different country, cascade the new
  // countryId down to its clubs/coaches/athletes so the denormalised copies
  // stay consistent.
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    countryId: string;
    name: string;
    nameKa?: string | null;
  }) {
    const country = await this.prisma.country.findFirst({
      where: { id: input.countryId, organisationId: input.organisationId },
      select: { id: true },
    });
    if (!country) {
      throw new HttpException(
        { code: 'COUNTRY_NOT_FOUND', message: 'Country not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = input.id
      ? await this.prisma.region.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.RegionUncheckedCreateInput = {
      organisationId: input.organisationId,
      countryId: input.countryId,
      name: input.name.trim(),
      nameKa: input.nameKa?.trim() || null,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.region.update({ where: { id: existing.id }, data })
        : await tx.region.create({ data });

      // Re-parented to another country → keep denormalised countryId in sync.
      if (existing && existing.countryId !== saved.countryId) {
        await tx.club.updateMany({
          where: { regionId: saved.id },
          data: { countryId: saved.countryId },
        });
        await tx.user.updateMany({
          where: { regionId: saved.id },
          data: { countryId: saved.countryId },
        });
        await tx.athlete.updateMany({
          where: { regionId: saved.id },
          data: { countryId: saved.countryId },
        });
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'REGION_UPDATED' : 'REGION_CREATED',
          entityType: 'region',
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

  // Delete — blocked while the region still has clubs, coaches or athletes.
  // Coaches/athletes carry a denormalised regionId that can be set without a
  // club, so they are checked directly (their FK relation is optional → SetNull).
  async remove(organisationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.region.findFirst({
      where: { id, organisationId },
      select: {
        id: true,
        _count: { select: { clubs: true, coaches: true, athletes: true } },
      },
    });
    if (!existing) {
      throw new HttpException(
        { code: 'REGION_NOT_FOUND', message: 'Region not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      existing._count.clubs > 0 ||
      existing._count.coaches > 0 ||
      existing._count.athletes > 0
    ) {
      throw new HttpException(
        {
          code: 'REGION_NOT_EMPTY',
          message: 'Move or remove this region’s clubs, coaches and athletes first',
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.region.delete({ where: { id } });
      await this.audit.write(
        {
          organisationId,
          actorUserId,
          action: 'REGION_DELETED',
          entityType: 'region',
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
