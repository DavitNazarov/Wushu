import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { validateCategoryTemplateStructure } from './category-template-structure.validator';
import type { CategoryOptionGroupInputDto } from './category-options.schemas';

@Injectable()
export class CategoryOptionsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Admin list — includes inactive groups/options so they can be managed. */
  async list() {
    return this.prisma.categoryOptionGroup.findMany({
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Reuse the exact rules the Category Template builder enforces (ascending
   * weights, open-ended division must be last, valid age/weight ranges) so the
   * library and the templates built from it stay consistent.
   */
  private assertValidStructure(dto: CategoryOptionGroupInputDto): void {
    validateCategoryTemplateStructure([
      {
        code: 'draft',
        name: dto.name,
        nameKa: dto.nameKa ?? null,
        sex: dto.sex ?? null,
        minAge: dto.minAge ?? null,
        maxAge: dto.maxAge ?? null,
        roundDurationSeconds: dto.roundDurationSeconds,
        sortOrder: 1,
        weightCategories: dto.weights.map((weight, index) => ({
          code: weight.id ?? `draft-${index}`,
          name: weight.name,
          minWeightKgExcl: weight.minWeightKgExcl,
          maxWeightKgIncl: weight.maxWeightKgIncl,
          sortOrder: index + 1,
        })),
      },
    ]);
  }

  async create(input: {
    organisationId: string;
    actorUserId: string;
    dto: CategoryOptionGroupInputDto;
  }) {
    this.assertValidStructure(input.dto);
    const { dto } = input;

    const maxSort = await this.prisma.categoryOptionGroup.aggregate({
      _max: { sortOrder: true },
    });

    const group = await this.prisma.categoryOptionGroup.create({
      data: {
        code: `grp_${randomUUID()}`,
        name: dto.name.trim(),
        nameKa: dto.nameKa?.trim() || null,
        sex: dto.sex ?? null,
        minAge: dto.minAge ?? null,
        maxAge: dto.maxAge ?? null,
        roundDurationSeconds: dto.roundDurationSeconds,
        isActive: dto.isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        options: {
          create: dto.weights.map((weight, index) => ({
            code: `opt_${randomUUID()}`,
            name: weight.name.trim(),
            minWeightKgExcl: weight.minWeightKgExcl,
            maxWeightKgIncl: weight.maxWeightKgIncl,
            sortOrder: index + 1,
            isActive: true,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      action: 'CATEGORY_OPTION_GROUP_CREATED',
      entityType: 'categoryOptionGroup',
      entityId: group.id,
      before: null,
      after: group as unknown as Prisma.JsonValue,
    });

    return group;
  }

  async update(input: {
    organisationId: string;
    actorUserId: string;
    groupId: string;
    dto: CategoryOptionGroupInputDto;
  }) {
    this.assertValidStructure(input.dto);
    const { dto, groupId } = input;

    const existing = await this.prisma.categoryOptionGroup.findUnique({
      where: { id: groupId },
      include: { options: true },
    });
    if (!existing) throw new Error('CATEGORY_OPTION_GROUP_NOT_FOUND');

    const existingIds = new Set(existing.options.map((option) => option.id));
    const keptIds = new Set(
      dto.weights
        .map((weight) => weight.id)
        .filter((id): id is string => Boolean(id) && existingIds.has(id!)),
    );
    const removedIds = existing.options
      .filter((option) => !keptIds.has(option.id))
      .map((option) => option.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.categoryOptionGroup.update({
        where: { id: groupId },
        data: {
          name: dto.name.trim(),
          nameKa: dto.nameKa?.trim() || null,
          sex: dto.sex ?? null,
          minAge: dto.minAge ?? null,
          maxAge: dto.maxAge ?? null,
          roundDurationSeconds: dto.roundDurationSeconds,
          isActive: dto.isActive ?? existing.isActive,
        },
      });

      if (removedIds.length) {
        await tx.categoryOption.deleteMany({
          where: { id: { in: removedIds }, groupId },
        });
      }

      // Update existing weights by id (preserves IDs so any template that
      // references them keeps its link); create newly added rows.
      for (let index = 0; index < dto.weights.length; index += 1) {
        const weight = dto.weights[index];
        if (weight.id && keptIds.has(weight.id)) {
          await tx.categoryOption.update({
            where: { id: weight.id },
            data: {
              name: weight.name.trim(),
              minWeightKgExcl: weight.minWeightKgExcl,
              maxWeightKgIncl: weight.maxWeightKgIncl,
              sortOrder: index + 1,
            },
          });
        } else {
          await tx.categoryOption.create({
            data: {
              groupId,
              code: `opt_${randomUUID()}`,
              name: weight.name.trim(),
              minWeightKgExcl: weight.minWeightKgExcl,
              maxWeightKgIncl: weight.maxWeightKgIncl,
              sortOrder: index + 1,
              isActive: true,
            },
          });
        }
      }

      return tx.categoryOptionGroup.findUnique({
        where: { id: groupId },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    await this.audit.write({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      action: 'CATEGORY_OPTION_GROUP_UPDATED',
      entityType: 'categoryOptionGroup',
      entityId: groupId,
      before: existing as unknown as Prisma.JsonValue,
      after: updated as unknown as Prisma.JsonValue,
    });

    return updated;
  }

  async remove(input: {
    organisationId: string;
    actorUserId: string;
    groupId: string;
  }) {
    const existing = await this.prisma.categoryOptionGroup.findUnique({
      where: { id: input.groupId },
      include: { options: true },
    });
    if (!existing) throw new Error('CATEGORY_OPTION_GROUP_NOT_FOUND');

    // Options cascade-delete with the group. Templates copy structure at build
    // time, so deleting a library entry never affects existing events.
    await this.prisma.categoryOptionGroup.delete({
      where: { id: input.groupId },
    });

    await this.audit.write({
      organisationId: input.organisationId,
      actorUserId: input.actorUserId,
      action: 'CATEGORY_OPTION_GROUP_DELETED',
      entityType: 'categoryOptionGroup',
      entityId: input.groupId,
      before: existing as unknown as Prisma.JsonValue,
      after: null,
    });
  }
}
