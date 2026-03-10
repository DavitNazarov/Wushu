import { ForbiddenException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('rejects suspended users on protected requests', async () => {
    const guard = new AuthGuard({
      verifyToken: jest.fn().mockReturnValue({ sub: 'user_1' }),
      validateAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ ok: false, code: 'USER_SUSPENDED' }),
    } as any);

    const req: any = {
      headers: { authorization: 'Bearer token_1' },
      cookies: {},
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('replaces JWT payload with current validated auth payload', async () => {
    const payload = {
      sub: 'user_1',
      organisationId: 'org_1',
      role: 'admin',
      capabilities: ['ATHLETES_MANAGE'],
      clubId: null,
    };

    const guard = new AuthGuard({
      verifyToken: jest.fn().mockReturnValue({ sub: 'user_1' }),
      validateAuthenticatedUser: jest.fn().mockResolvedValue({
        ok: true,
        payload,
      }),
    } as any);

    const req: any = {
      headers: { authorization: 'Bearer token_1' },
      cookies: {},
    };

    const context: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    };

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.auth).toEqual(payload);
  });
});
