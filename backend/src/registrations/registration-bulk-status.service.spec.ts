import { RegistrationBulkStatusService } from './registration-bulk-status.service';

// Rewritten for the current service shape: a single PrismaService dependency,
// one findMany read, then guarded updateMany(s) + auditLog.createMany inside one
// prisma.$transaction. Covers BF-8 (transition-table enforcement in bulk) and
// BF-13 (status-guarded writes).
describe('RegistrationBulkStatusService', () => {
  function makeService(
    rows: Array<{ id: string; status: string; lifecycle: string }>,
  ) {
    const updateMany = jest.fn();
    const createMany = jest.fn();
    const prisma = {
      registration: {
        findMany: jest.fn().mockResolvedValue(
          rows.map((r) => ({
            id: r.id,
            status: r.status,
            event: { id: 'event-1', lifecycle: r.lifecycle },
          })),
        ),
        updateMany,
        createMany,
      },
      auditLog: { createMany },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new RegistrationBulkStatusService(prisma as never);
    return { service, prisma, updateMany };
  }

  it('dedupes ids, skips already-target rows, and fails missing rows', async () => {
    const { service, prisma } = makeService([
      { id: 'reg-1', status: 'PENDING', lifecycle: 'REG_OPEN' },
      { id: 'reg-2', status: 'APPROVED', lifecycle: 'REG_OPEN' },
    ]);

    const result = await service.setStatus({
      organisationId: 'org-1',
      registrationIds: ['reg-1', 'reg-1', 'reg-2', 'missing'],
      actorUserId: 'user-1',
      newStatus: 'APPROVED',
    });

    expect(prisma.registration.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: 'org-1',
        id: { in: ['reg-1', 'reg-2', 'missing'] },
      },
      select: {
        id: true,
        status: true,
        event: { select: { id: true, lifecycle: true } },
      },
    });
    expect(result.requestedCount).toBe(3);
    expect(result.updatedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });

  // BF-8: an indirect transition (WITHDRAWN -> APPROVED) must require a reason
  // even while the event is still registration-mutable (REG_OPEN).
  it('fails an indirect transition with no reason even during a mutable stage', async () => {
    const { service } = makeService([
      { id: 'reg-1', status: 'WITHDRAWN', lifecycle: 'REG_OPEN' },
    ]);

    const result = await service.setStatus({
      organisationId: 'org-1',
      registrationIds: ['reg-1'],
      actorUserId: 'user-1',
      newStatus: 'APPROVED',
    });

    expect(result.failedCount).toBe(1);
    expect(result.results[0]).toEqual({
      registrationId: 'reg-1',
      outcome: 'FAILED',
      errorCode: 'OVERRIDE_REASON_REQUIRED',
    });
  });

  it('allows the indirect transition once a reason is supplied', async () => {
    const { service, prisma } = makeService([
      { id: 'reg-1', status: 'WITHDRAWN', lifecycle: 'REG_OPEN' },
    ]);

    const result = await service.setStatus({
      organisationId: 'org-1',
      registrationIds: ['reg-1'],
      actorUserId: 'user-1',
      newStatus: 'APPROVED',
      reason: 'admin correction',
    });

    expect(result.updatedCount).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // BF-13: the write is guarded by the status we observed, so a row changed
  // concurrently becomes a no-op rather than a lost update.
  it('guards updateMany with the observed status', async () => {
    const { service, updateMany } = makeService([
      { id: 'reg-1', status: 'PENDING', lifecycle: 'REG_OPEN' },
    ]);

    await service.setStatus({
      organisationId: 'org-1',
      registrationIds: ['reg-1'],
      actorUserId: 'user-1',
      newStatus: 'APPROVED',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['reg-1'] },
        organisationId: 'org-1',
        status: 'PENDING',
      },
      data: { status: 'APPROVED' },
    });
  });
});
