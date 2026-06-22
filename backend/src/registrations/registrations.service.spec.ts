import { RegistrationsService } from './registrations.service';

// Minimal sanity test for the tenant-scoping invariant. The risk this guards:
// if someone refactors list() and accidentally drops the organisationId
// from the WHERE clause, all org data leaks across tenants. Cheap to keep.
const createPrismaMock = () => {
  const prisma: any = {
    registration: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return prisma;
};

const createAuditMock = () => ({
  write: jest.fn(),
});

describe('RegistrationsService org scoping', () => {
  // Pin the invariant: any list() call MUST land an organisationId in the
  // WHERE clause. Asserts on the call shape rather than the resolved data.
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
