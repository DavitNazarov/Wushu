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
    // Interactive transaction: run the callback against the same mock client
    // so tx.refreshToken.* resolves to refreshTokenModel above.
    $transaction: jest.fn(),
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
    (prisma.$transaction as jest.Mock).mockImplementation(
      (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    );
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
    // The storage-unavailable error now surfaces from the atomic consume
    // (updateMany) inside the rotation transaction.
    refreshTokenModel.updateMany.mockRejectedValueOnce(
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
        // Access tokens carry a `type: 'access'` discriminator (auth.service.ts);
        // verifyToken rejects any token whose type !== 'access'.
        type: 'access',
      },
    });
    expect(storeSpy).toHaveBeenCalledWith('user_1', 'refresh_2');
  });

  it('atomically consumes the live token and stores exactly one new token', async () => {
    refreshTokenModel.updateMany.mockResolvedValueOnce({ count: 1 }); // consume wins
    refreshTokenModel.create.mockResolvedValueOnce({});

    const service = new AuthService(prisma, audit);
    jest.spyOn(service, 'verifyRefreshToken').mockReturnValue(payload);
    jest.spyOn(service, 'signToken').mockReturnValue('access_2');
    jest.spyOn(service, 'signRefreshToken').mockReturnValue('refresh_2');

    const result = await service.verifyAndRotateRefreshToken('refresh_1');

    expect(result).toMatchObject({
      accessToken: 'access_2',
      refreshToken: 'refresh_2',
    });
    // Consume is a conditional CAS guarded by revokedAt: null + not-expired.
    expect(refreshTokenModel.updateMany).toHaveBeenCalledTimes(1);
    const consume = refreshTokenModel.updateMany.mock.calls[0][0] as {
      where: { revokedAt: null; expiresAt: { gt: Date } };
    };
    expect(consume.where.revokedAt).toBeNull();
    expect(consume.where.expiresAt).toEqual({ gt: expect.any(Date) });
    // Exactly one new refresh token persisted, inside the same transaction.
    expect(refreshTokenModel.create).toHaveBeenCalledTimes(1);
  });

  it('treats a token it cannot consume as reuse: revokes the chain and returns null', async () => {
    // Loser of the race / already-revoked / expired token: nothing live to consume.
    refreshTokenModel.updateMany.mockResolvedValueOnce({ count: 0 }); // consume finds nothing
    refreshTokenModel.updateMany.mockResolvedValueOnce({ count: 3 }); // chain revoke

    const service = new AuthService(prisma, audit);
    jest.spyOn(service, 'verifyRefreshToken').mockReturnValue(payload);
    const signSpy = jest.spyOn(service, 'signRefreshToken');

    const result = await service.verifyAndRotateRefreshToken('refresh_1');

    expect(result).toBeNull();
    // No new token minted for a reused token.
    expect(refreshTokenModel.create).not.toHaveBeenCalled();
    expect(signSpy).not.toHaveBeenCalled();
    // Second updateMany is the whole-chain revoke (revokeUserRefreshTokens).
    expect(refreshTokenModel.updateMany).toHaveBeenCalledTimes(2);
    const revoke = refreshTokenModel.updateMany.mock.calls[1][0] as {
      where: unknown;
    };
    expect(revoke.where).toEqual({ userId: 'user_1', revokedAt: null });
  });
});
