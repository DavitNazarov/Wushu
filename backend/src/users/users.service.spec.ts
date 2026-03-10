import { UsersService } from './users.service';

function createPrismaMock() {
  const prisma: any = {
    club: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<unknown>) =>
      fn(prisma),
    ),
  };

  return prisma;
}

function createAuditMock() {
  return {
    write: jest.fn(),
  };
}

function createAuthUserMock() {
  return {
    registerUser: jest.fn(),
  };
}

const baseUser = {
  id: 'user_1',
  organisationId: 'org_1',
  email: 'coach@example.com',
  displayName: 'Coach User',
  role: 'coach',
  clubId: 'club_1',
  isActive: true,
  deletedAt: null,
  dqReason: null,
  dqStartAt: null,
  dqEndAt: null,
  dqNote: null,
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-02T10:00:00.000Z'),
  club: { id: 'club_1', name: 'Club One' },
} as const;

describe('UsersService', () => {
  it('requires a club when promoting admin to coach without clubId', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce({
      ...baseUser,
      role: 'admin',
      clubId: null,
      club: null,
    });

    const service = new UsersService(
      prisma,
      createAuditMock() as any,
      createAuthUserMock() as any,
    );

    await expect(
      service.update({
        organisationId: 'org_1',
        actorUserId: 'admin_1',
        userId: 'user_1',
        role: 'coach',
      }),
    ).rejects.toThrow('COACH_CLUB_REQUIRED');
  });

  it('rejects suspending self', async () => {
    const service = new UsersService(
      createPrismaMock(),
      createAuditMock() as any,
      createAuthUserMock() as any,
    );

    await expect(
      service.suspend({
        organisationId: 'org_1',
        actorUserId: 'user_1',
        userId: 'user_1',
        reason: 'reason',
        startAt: new Date('2026-03-09T00:00:00.000Z'),
        endAt: new Date('2026-03-10T00:00:00.000Z'),
      }),
    ).rejects.toThrow('SELF_DQ_FORBIDDEN');
  });

  it('archives users by soft delete and revokes refresh tokens', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce(baseUser);
    prisma.user.update.mockResolvedValueOnce({
      ...baseUser,
      deletedAt: new Date('2026-03-09T12:00:00.000Z'),
      isActive: false,
    });

    const service = new UsersService(
      prisma,
      createAuditMock() as any,
      createAuthUserMock() as any,
    );

    const result = await service.archive({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      userId: 'user_1',
    });

    expect(result.status).toBe('ARCHIVED');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('removes suspension fields when requested', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValueOnce({
      ...baseUser,
      dqReason: 'Misconduct',
      dqStartAt: new Date('2026-03-09T00:00:00.000Z'),
      dqEndAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.user.update.mockResolvedValueOnce(baseUser);

    const service = new UsersService(
      prisma,
      createAuditMock() as any,
      createAuthUserMock() as any,
    );

    const result = await service.removeSuspension({
      organisationId: 'org_1',
      actorUserId: 'admin_1',
      userId: 'user_1',
    });

    expect(result.disciplinary.reason).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dqReason: null,
          dqStartAt: null,
          dqEndAt: null,
          dqNote: null,
        }),
      }),
    );
  });
});
