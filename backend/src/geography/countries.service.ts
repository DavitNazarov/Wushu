import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { resolvePublicOrg } from '../common/public-org';

// Country CRUD — top of the geography hierarchy (Country → Region → Club).
// Org-scoped; writes are admin-only (enforced in the controller) and audited.
@Injectable()
export class CountriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Public list — resolves the public org; returns [] when not configured.
  async listPublic() {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return [];

    const rows = await this.prisma.country.findMany({
      where: { organisationId: org.id },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameKa: true,
        code: true,
        _count: { select: { regions: true, clubs: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      nameKa: c.nameKa,
      code: c.code,
      regionCount: c._count.regions,
      clubCount: c._count.clubs,
    }));
  }

  // Public country detail — returns null when not found in the public org.
  async getPublicById(id: string) {
    const org = await resolvePublicOrg(this.prisma);
    if (!org) return null;

    const country = await this.prisma.country.findFirst({
      where: { id, organisationId: org.id },
      select: {
        id: true,
        name: true,
        nameKa: true,
        code: true,
        regions: {
          orderBy: [{ name: 'asc' }],
          select: {
            id: true,
            name: true,
            nameKa: true,
            _count: { select: { clubs: true } },
          },
        },
        clubs: {
          orderBy: [{ name: 'asc' }],
          select: {
            id: true,
            name: true,
            nameKa: true,
            city: true,
            region: { select: { id: true, name: true, nameKa: true } },
          },
        },
      },
    });
    if (!country) return null;
    return {
      id: country.id,
      name: country.name,
      nameKa: country.nameKa,
      code: country.code,
      regions: country.regions.map((r) => ({
        id: r.id,
        name: r.name,
        nameKa: r.nameKa,
        clubCount: r._count.clubs,
      })),
      clubs: country.clubs.map((c) => ({
        id: c.id,
        name: c.name,
        nameKa: c.nameKa,
        city: c.city,
        region: c.region
          ? { id: c.region.id, name: c.region.name, nameKa: c.region.nameKa }
          : null,
      })),
    };
  }

  // Admin list, alphabetical, with region + club counts for the table.
  async list(organisationId: string) {
    const rows = await this.prisma.country.findMany({
      where: { organisationId },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameKa: true,
        code: true,
        _count: { select: { regions: true, clubs: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      nameKa: c.nameKa,
      code: c.code,
      regionCount: c._count.regions,
      clubCount: c._count.clubs,
    }));
  }

  // Country detail for the drill-down page: the country + its regions (each
  // with a club count). Returns null when not found in this org.
  async getById(organisationId: string, id: string) {
    const country = await this.prisma.country.findFirst({
      where: { id, organisationId },
      select: {
        id: true,
        name: true,
        nameKa: true,
        code: true,
        regions: {
          orderBy: [{ name: 'asc' }],
          select: {
            id: true,
            name: true,
            nameKa: true,
            _count: { select: { clubs: true } },
          },
        },
      },
    });
    if (!country) return null;
    return {
      id: country.id,
      name: country.name,
      nameKa: country.nameKa,
      code: country.code,
      regions: country.regions.map((r) => ({
        id: r.id,
        name: r.name,
        nameKa: r.nameKa,
        clubCount: r._count.clubs,
      })),
    };
  }

  // Create-or-update. Trims strings, empties → null, uppercases the ISO code.
  async upsert(input: {
    organisationId: string;
    actorUserId: string;
    id?: string;
    name: string;
    nameKa?: string | null;
    code?: string | null;
  }) {
    const existing = input.id
      ? await this.prisma.country.findFirst({
          where: { id: input.id, organisationId: input.organisationId },
        })
      : null;

    const data: Prisma.CountryUncheckedCreateInput = {
      organisationId: input.organisationId,
      name: input.name.trim(),
      nameKa: input.nameKa?.trim() || null,
      code: input.code?.trim().toUpperCase() || null,
    };

    return this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.country.update({ where: { id: existing.id }, data })
        : await tx.country.create({ data });

      await this.audit.write(
        {
          organisationId: input.organisationId,
          actorUserId: input.actorUserId,
          action: existing ? 'COUNTRY_UPDATED' : 'COUNTRY_CREATED',
          entityType: 'country',
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

  // Delete — blocked while the country still has regions, clubs, coaches or
  // athletes attached, so the hierarchy can never be left dangling. Coaches and
  // athletes carry a denormalised countryId that can be set without a club, so
  // they are checked directly (their FK relation is optional → SetNull).
  async remove(organisationId: string, actorUserId: string, id: string) {
    const existing = await this.prisma.country.findFirst({
      where: { id, organisationId },
      select: {
        id: true,
        _count: {
          select: { regions: true, clubs: true, coaches: true, athletes: true },
        },
      },
    });
    if (!existing) {
      throw new HttpException(
        { code: 'COUNTRY_NOT_FOUND', message: 'Country not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      existing._count.regions > 0 ||
      existing._count.clubs > 0 ||
      existing._count.coaches > 0 ||
      existing._count.athletes > 0
    ) {
      throw new HttpException(
        {
          code: 'COUNTRY_NOT_EMPTY',
          message:
            'Remove this country’s regions, clubs, coaches and athletes first',
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.country.delete({ where: { id } });
      await this.audit.write(
        {
          organisationId,
          actorUserId,
          action: 'COUNTRY_DELETED',
          entityType: 'country',
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
