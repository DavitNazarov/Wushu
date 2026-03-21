import { CategoryTemplateAdminService } from './category-template-admin.service';

function createPrismaMock() {
  const prisma: any = {
    categoryTemplate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventAgeGroup: {
      count: jest.fn(),
    },
    eventWeightCategory: {
      count: jest.fn(),
    },
    event: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    categoryOption: {
      findMany: jest.fn(),
    },
    categoryTemplateWeight: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    categoryTemplateAgeGroup: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
  };

  return prisma;
}

function createAuditMock() {
  return {
    write: jest.fn(),
  };
}

const customTemplate = {
  id: 'tpl_1',
  organisationId: 'org_1',
  name: 'Club template',
  version: 2,
  status: 'DRAFT',
  definition: {
    type: 'CATEGORY_TEMPLATE',
    source: 'ADMIN_DEFINED',
    categoryOptionIds: ['opt_1'],
  },
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-02T10:00:00.000Z'),
} as const;

describe('CategoryTemplateAdminService', () => {
  it('blocks structure edits when the template is already used by events', async () => {
    const prisma = createPrismaMock();
    prisma.categoryTemplate.findFirst.mockResolvedValueOnce(customTemplate);
    prisma.event.count.mockResolvedValueOnce(1);
    prisma.eventAgeGroup.count.mockResolvedValueOnce(0);
    prisma.eventWeightCategory.count.mockResolvedValueOnce(0);
    prisma.event.findMany.mockResolvedValueOnce([]);

    const service = new CategoryTemplateAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.update({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        categoryTemplateId: 'tpl_1',
        dto: { categoryOptionIds: ['opt_2'] },
      }),
    ).rejects.toThrow('CATEGORY_TEMPLATE_STRUCTURE_LOCKED_BY_USAGE');
  });

  it('blocks deleting active templates', async () => {
    const prisma = createPrismaMock();
    prisma.categoryTemplate.findFirst.mockResolvedValueOnce({
      ...customTemplate,
      status: 'ACTIVE',
    });
    prisma.event.count.mockResolvedValueOnce(0);
    prisma.eventAgeGroup.count.mockResolvedValueOnce(0);
    prisma.eventWeightCategory.count.mockResolvedValueOnce(0);
    prisma.event.findMany.mockResolvedValueOnce([]);

    const service = new CategoryTemplateAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.remove({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        categoryTemplateId: 'tpl_1',
      }),
    ).rejects.toThrow('ACTIVE_CATEGORY_TEMPLATE_DELETE_FORBIDDEN');
  });

  it('blocks edits for system templates', async () => {
    const prisma = createPrismaMock();
    prisma.categoryTemplate.findFirst.mockResolvedValueOnce({
      ...customTemplate,
      organisationId: null,
      definition: {
        type: 'CATEGORY_TEMPLATE',
        source: 'SYSTEM_BUILT_IN',
        optionGroupCodes: ['adult_male'],
      },
    });
    prisma.event.count.mockResolvedValueOnce(0);
    prisma.eventAgeGroup.count.mockResolvedValueOnce(0);
    prisma.eventWeightCategory.count.mockResolvedValueOnce(0);
    prisma.event.findMany.mockResolvedValueOnce([]);

    const service = new CategoryTemplateAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.update({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        categoryTemplateId: 'tpl_1',
        dto: { name: 'Changed' },
      }),
    ).rejects.toThrow('SYSTEM_CATEGORY_TEMPLATE_PROTECTED');
  });

  it('allows deleting a draft template when no events reference it', async () => {
    const prisma = createPrismaMock();
    prisma.categoryTemplate.findFirst.mockResolvedValueOnce(customTemplate);
    prisma.event.count.mockResolvedValueOnce(0);
    prisma.eventAgeGroup.count.mockResolvedValueOnce(0);
    prisma.eventWeightCategory.count.mockResolvedValueOnce(0);
    prisma.event.findMany.mockResolvedValueOnce([]);
    prisma.categoryTemplate.delete.mockResolvedValueOnce(customTemplate);

    const service = new CategoryTemplateAdminService(
      prisma,
      createAuditMock() as any,
    );

    await expect(
      service.remove({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        categoryTemplateId: 'tpl_1',
      }),
    ).resolves.toBeUndefined();
  });
});
