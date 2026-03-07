import { RegistrationsService } from './registrations.service';

const createPrismaMock = () => {
  const prisma: any = {
    registration: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return prisma;
};

const createAuditMock = () => ({
  write: jest.fn(),
});

describe('RegistrationsService org scoping', () => {
  it('always scopes list queries by organisationId', async () => {
    const prisma = createPrismaMock();
    const audit = createAuditMock();
    const service = new RegistrationsService(prisma, audit as any);

    await service.list({ organisationId: 'org_abc', eventId: 'event_1' });

    expect(prisma.registration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'org_abc',
          eventId: 'event_1',
        }),
      }),
    );
  });
});
