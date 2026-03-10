import { Prisma } from '@prisma/client';
import { AuthService, type AuthTokenPayload } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { getCapabilitiesForRole } from './capabilities';

function knownPrismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('test', {
    code,
    clientVersion: 'test',
  });
}

describe('AuthService refresh token storage fallback', () => {
  const refreshTokenModel = {
    create: jest.fn<Promise<unknown>, [unknown]>(),
    findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    update: jest.fn<Promise<unknown>, [unknown]>(),
    updateMany: jest.fn<Promise<unknown>, [unknown]>(),
  };

  const prisma = {
    refreshToken: refreshTokenModel,
    user: {
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
    },
  } as unknown as PrismaService;

  const audit = {
    write: jest.fn<Promise<void>, [unknown]>(),
  } as unknown as AuditService;

  const payload: AuthTokenPayload = {
    sub: 'user_1',
    organisationId: 'org_1',
    role: 'admin',
    capabilities: ['EVENTS_MANAGE'],
    clubId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user_1',
      organisationId: 'org_1',
      role: 'admin',
      clubId: null,
      isActive: true,
      deletedAt: null,
      dqStartAt: null,
      dqEndAt: null,
      capabilities: [],
    });
  });

  it('does not throw when RefreshToken storage is missing on login token store', async () => {
    refreshTokenModel.create.mockRejectedValueOnce(knownPrismaError('P2021'));
    const service = new AuthService(prisma, audit);

    await expect(
      service.storeRefreshToken('user_1', 'token_1'),
    ).resolves.toBeUndefined();
  });

  it('falls back to stateless rotation when RefreshToken table is unavailable', async () => {
    refreshTokenModel.findUnique.mockRejectedValueOnce(
      knownPrismaError('P2021'),
    );

    const service = new AuthService(prisma, audit);
    jest.spyOn(service, 'verifyRefreshToken').mockReturnValue(payload);
    jest.spyOn(service, 'signToken').mockReturnValue('access_2');
    jest.spyOn(service, 'signRefreshToken').mockReturnValue('refresh_2');
    const storeSpy = jest
      .spyOn(service, 'storeRefreshToken')
      .mockResolvedValue(undefined);

    await expect(
      service.verifyAndRotateRefreshToken('refresh_1'),
    ).resolves.toEqual({
      accessToken: 'access_2',
      refreshToken: 'refresh_2',
      payload: {
        ...payload,
        capabilities: getCapabilitiesForRole('admin'),
      },
    });
    expect(storeSpy).toHaveBeenCalledWith('user_1', 'refresh_2');
  });
});
