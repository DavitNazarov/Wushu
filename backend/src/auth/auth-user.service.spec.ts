import { AuthUserService } from './auth-user.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';

const createPrismaMock = () => ({
  club: {
    findFirst: jest.fn(),
  },
  user: {
    create: jest.fn(),
    count: jest.fn(),
  },
  organisation: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
});

const createAuditMock = () => ({
  write: jest.fn(),
});

function createService(prisma = createPrismaMock(), audit = createAuditMock()) {
  return {
    prisma,
    audit,
    service: new AuthUserService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    ),
  };
}

describe('AuthUserService', () => {
  const organisationId = 'org_123';
  const actorUserId = 'user_123';

  it('requires clubId for coach users', async () => {
    const { service } = createService();

    await expect(
      service.registerUser({
        organisationId,
        actorUserId,
        email: 'coach@example.com',
        password: 'secret123',
        displayName: 'Coach User',
        role: 'coach',
        clubId: null,
      }),
    ).rejects.toThrow('COACH_CLUB_REQUIRED');
  });

  it('rejects clubId for admin users', async () => {
    const { service } = createService();

    await expect(
      service.registerUser({
        organisationId,
        actorUserId,
        email: 'admin@example.com',
        password: 'secret123',
        displayName: 'Admin User',
        role: 'admin',
        clubId: 'club_1',
      }),
    ).rejects.toThrow('ADMIN_CLUB_FORBIDDEN');
  });

  it('rejects clubId that does not belong to the organisation', async () => {
    const prisma = createPrismaMock();
    prisma.club.findFirst.mockResolvedValue(null);
    const { service } = createService(prisma);

    await expect(
      service.registerUser({
        organisationId,
        actorUserId,
        email: 'coach@example.com',
        password: 'secret123',
        displayName: 'Coach User',
        role: 'coach',
        clubId: 'club_missing',
      }),
    ).rejects.toThrow('INVALID_CLUB');
  });

  it('creates coach user with clubId when club exists', async () => {
    const prisma = createPrismaMock();
    prisma.club.findFirst.mockResolvedValue({ id: 'club_1' });
    prisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'coach@example.com',
      displayName: 'Coach User',
      role: 'coach',
      clubId: 'club_1',
    });
    const { service } = createService(prisma);

    const result = await service.registerUser({
      organisationId,
      actorUserId,
      email: ' coach@example.com ',
      password: 'secret123',
      displayName: ' Coach User ',
      role: 'coach',
      clubId: 'club_1',
    });

    expect(result).toEqual({ id: 'user_1' });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId,
        email: 'coach@example.com',
        displayName: 'Coach User',
        clubId: 'club_1',
      }),
    });
  });

  it('creates admin user without clubId', async () => {
    const prisma = createPrismaMock();
    prisma.user.create.mockResolvedValue({
      id: 'user_admin_1',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'admin',
      clubId: null,
    });
    const { service } = createService(prisma);

    const result = await service.registerUser({
      organisationId,
      actorUserId,
      email: ' admin@example.com ',
      password: 'secret123',
      displayName: ' Admin User ',
      role: 'admin',
      clubId: null,
    });

    expect(result).toEqual({ id: 'user_admin_1' });
    expect(prisma.club.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId,
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        clubId: null,
      }),
    });
  });
});
