import { CategoryOptionsAdminService } from './category-options-admin.service';

function createPrismaMock() {
  const prisma: any = {
    categoryOptionGroup: {
      findMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 4 } }),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    categoryOption: {
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };
  return prisma;
}

function createAuditMock() {
  return { write: jest.fn() };
}

const baseDto = {
  name: 'Custom Men',
  nameKa: 'მამაკაცები',
  sex: 'MALE' as const,
  minAge: 18,
  maxAge: 40,
  roundDurationSeconds: 120,
  weights: [
    { name: '60kg', minWeightKgExcl: null, maxWeightKgIncl: 60 },
    { name: '65kg', minWeightKgExcl: 60, maxWeightKgIncl: 65 },
    { name: '+65kg', minWeightKgExcl: 65, maxWeightKgIncl: null },
  ],
};

describe('CategoryOptionsAdminService', () => {
  it('creates a group with generated codes, bilingual name, and audit', async () => {
    const prisma = createPrismaMock();
    prisma.categoryOptionGroup.create.mockResolvedValue({
      id: 'grp_1',
      options: [],
    });
    const audit = createAuditMock();
    const service = new CategoryOptionsAdminService(prisma, audit as any);

    await service.create({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      dto: baseDto,
    });

    const data = prisma.categoryOptionGroup.create.mock.calls[0][0].data;
    expect(data.code).toMatch(/^grp_/);
    expect(data.nameKa).toBe('მამაკაცები');
    expect(data.sortOrder).toBe(5); // max 4 + 1
    expect(data.options.create).toHaveLength(3);
    expect(data.options.create[0].code).toMatch(/^opt_/);
    expect(data.options.create[2].maxWeightKgIncl).toBeNull(); // open-ended last
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CATEGORY_OPTION_GROUP_CREATED' }),
    );
  });

  it('nulls a blank Georgian name', async () => {
    const prisma = createPrismaMock();
    prisma.categoryOptionGroup.create.mockResolvedValue({
      id: 'g',
      options: [],
    });
    const service = new CategoryOptionsAdminService(
      prisma,
      createAuditMock() as any,
    );

    await service.create({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      dto: { ...baseDto, nameKa: '   ' },
    });

    expect(
      prisma.categoryOptionGroup.create.mock.calls[0][0].data.nameKa,
    ).toBeNull();
  });

  it('rejects non-ascending weight divisions', async () => {
    const prisma = createPrismaMock();
    const service = new CategoryOptionsAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.create({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        dto: {
          ...baseDto,
          weights: [
            { name: '65kg', minWeightKgExcl: null, maxWeightKgIncl: 65 },
            { name: '60kg', minWeightKgExcl: null, maxWeightKgIncl: 60 },
          ],
        },
      }),
    ).rejects.toThrow('WEIGHT_CATEGORIES_NOT_STRICTLY_ASCENDING');
    expect(prisma.categoryOptionGroup.create).not.toHaveBeenCalled();
  });

  it('rejects an open-ended division that is not last', async () => {
    const prisma = createPrismaMock();
    const service = new CategoryOptionsAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.create({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        dto: {
          ...baseDto,
          weights: [
            { name: '+60kg', minWeightKgExcl: null, maxWeightKgIncl: null },
            { name: '65kg', minWeightKgExcl: 60, maxWeightKgIncl: 65 },
          ],
        },
      }),
    ).rejects.toThrow('OPEN_WEIGHT_CATEGORY_MUST_BE_LAST');
  });

  it('updates: keeps existing weights by id, adds new, deletes removed', async () => {
    const prisma = createPrismaMock();
    prisma.categoryOptionGroup.findUnique
      .mockResolvedValueOnce({
        id: 'grp_1',
        isActive: true,
        options: [
          { id: 'opt_a', name: '60kg' },
          { id: 'opt_b', name: '65kg' },
        ],
      })
      .mockResolvedValueOnce({ id: 'grp_1', options: [] });
    const service = new CategoryOptionsAdminService(
      prisma,
      createAuditMock() as any,
    );

    await service.update({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      groupId: 'grp_1',
      dto: {
        ...baseDto,
        weights: [
          {
            id: 'opt_a',
            name: '60kg',
            minWeightKgExcl: null,
            maxWeightKgIncl: 60,
          },
          { name: '70kg', minWeightKgExcl: 60, maxWeightKgIncl: 70 },
        ],
      },
    });

    expect(prisma.categoryOption.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['opt_b'] }, groupId: 'grp_1' },
    });
    expect(prisma.categoryOption.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'opt_a' } }),
    );
    expect(prisma.categoryOption.create).toHaveBeenCalledTimes(1);
  });

  it('throws when updating a missing group', async () => {
    const prisma = createPrismaMock();
    prisma.categoryOptionGroup.findUnique.mockResolvedValue(null);
    const service = new CategoryOptionsAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.update({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        groupId: 'missing',
        dto: baseDto,
      }),
    ).rejects.toThrow('CATEGORY_OPTION_GROUP_NOT_FOUND');
  });

  it('deletes an existing group', async () => {
    const prisma = createPrismaMock();
    prisma.categoryOptionGroup.findUnique.mockResolvedValue({
      id: 'grp_1',
      options: [],
    });
    const audit = createAuditMock();
    const service = new CategoryOptionsAdminService(prisma, audit as any);

    await service.remove({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      groupId: 'grp_1',
    });

    expect(prisma.categoryOptionGroup.delete).toHaveBeenCalledWith({
      where: { id: 'grp_1' },
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CATEGORY_OPTION_GROUP_DELETED' }),
    );
  });
});
