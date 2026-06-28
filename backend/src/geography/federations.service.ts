import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

// Federation CRUD — sits between City and Club in the hierarchy
// (Country → City → Federation → Club). Org-scoped; writes admin-only.
@Injectable()
export class FederationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // List federations, optionally filtered to one city (cascading picker).
  async list(organisationId: string, cityId?: string) {
    const rows = await this.prisma.federation.findMany({
      where: { organisationId, ...(cityId ? { cityId } : {}) },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        cityId: true,
        countryId: true,
        name: true,
        nameKa: true,
        isOfficial: true,
        city: { select: { name: true, nameKa: true } },
        country: { select: { name: true, nameKa: true } },
        _count: { select: { clubs: true } },
      },
    });
    return rows.map((f) => ({
      id: f.id,
      cityId: f.cityId,
      countryId: f.countryId,
      name: f.name,
      nameKa: f.nameKa,
      isOfficial: f.isOfficial,
      cityName: f.city.name,
      cityNameKa: f.city.nameKa,
      countryName: f.country.name,
      countryNameKa: f.country.nameKa,
      clubCount: f._count.clubs,
    }));
  }

  // Create-or-update. countryId is derived from the chosen city. Re-parenting to
  // another city cascades the new city/country down to this federation's clubs.
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    cityId: string;
    name: string;
    nameKa?: string | null;
    isOfficial: boolean;
  }) {
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

    const existing = input.id
      ? await this.prisma.federation.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.FederationUncheckedCreateInput = {
      organisationId: input.organisationId,
      cityId: city.id,
      countryId: city.countryId,
      name: input.name.trim(),
      nameKa: input.nameKa?.trim() || null,
      isOfficial: input.isOfficial,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.federation.update({ where: { id: existing.id }, data })
        : await tx.federation.create({ data });

      if (existing && existing.cityId !== saved.cityId) {
        await tx.club.updateMany({
          where: { federationId: saved.id },
          data: { cityId: saved.cityId, countryId: saved.countryId },
        });
      }

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'FEDERATION_UPDATED' : 'FEDERATION_CREATED',
          entityType: 'federation',
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

  // Delete — blocked while the federation still has clubs.
  async remove(organisationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.federation.findFirst({
      where: { id, organisationId },
      select: { id: true, _count: { select: { clubs: true } } },
    });
    if (!existing) {
      throw new HttpException(
        { code: 'FEDERATION_NOT_FOUND', message: 'Federation not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing._count.clubs > 0) {
      throw new HttpException(
        {
          code: 'FEDERATION_NOT_EMPTY',
          message: 'Move or remove this federation’s clubs first',
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.federation.delete({ where: { id } });
      await this.audit.write(
        {
          organisationId,
          actorUserId,
          action: 'FEDERATION_DELETED',
          entityType: 'federation',
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
