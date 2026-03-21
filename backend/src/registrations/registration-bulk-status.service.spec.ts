import { RegistrationBulkStatusService } from './registration-bulk-status.service';

describe('RegistrationBulkStatusService', () => {
  it('updates unique registrations and skips duplicates or already-targeted rows', async () => {
    const prisma = {
      registration: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'reg-1', status: 'PENDING' },
          { id: 'reg-2', status: 'APPROVED' },
        ]),
      },
    };
    const registrations = {
      setStatus: jest.fn().mockResolvedValue({ id: 'reg-1', status: 'APPROVED' }),
    };

    const service = new RegistrationBulkStatusService(
      prisma as never,
      registrations as never,
    );

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
      },
    });
    expect(registrations.setStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      requestedCount: 3,
      updatedCount: 1,
      skippedCount: 1,
      failedCount: 1,
      results: [
        { registrationId: 'reg-1', outcome: 'UPDATED' },
        {
          registrationId: 'reg-2',
          outcome: 'SKIPPED',
          errorCode: 'ALREADY_IN_TARGET_STATUS',
        },
        {
          registrationId: 'missing',
          outcome: 'FAILED',
          errorCode: 'REGISTRATION_NOT_FOUND',
        },
      ],
    });
  });
});
