describe('resolvePublicOrg', () => {
  const originalPublicOrgSlug = process.env.PUBLIC_ORG_SLUG;

  afterEach(() => {
    if (originalPublicOrgSlug === undefined) {
      delete process.env.PUBLIC_ORG_SLUG;
    } else {
      process.env.PUBLIC_ORG_SLUG = originalPublicOrgSlug;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  function loadPublicOrgModule(): typeof import('./public-org') {
    let module: typeof import('./public-org') | undefined;
    jest.isolateModules(() => {
      module = require('./public-org') as typeof import('./public-org');
    });
    if (!module) throw new Error('Failed to load public-org module');
    return module;
  }

  it('uses PUBLIC_ORG_SLUG when it is configured', async () => {
    process.env.PUBLIC_ORG_SLUG = 'public-org';
    const { resolvePublicOrg } = loadPublicOrgModule();
    const prisma = {
      organisation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'org_public' }),
        findFirst: jest.fn(),
      },
    };

    await expect(resolvePublicOrg(prisma as never)).resolves.toEqual({
      id: 'org_public',
    });
    expect(prisma.organisation.findUnique).toHaveBeenCalledWith({
      where: { slug: 'public-org' },
    });
    expect(prisma.organisation.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to the oldest active-admin organisation', async () => {
    delete process.env.PUBLIC_ORG_SLUG;
    const { resolvePublicOrg } = loadPublicOrgModule();
    const prisma = {
      organisation: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValueOnce({ id: 'org_admin' }),
      },
    };

    await expect(resolvePublicOrg(prisma as never)).resolves.toEqual({
      id: 'org_admin',
    });
    expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
    expect(prisma.organisation.findFirst).toHaveBeenCalledWith({
      where: {
        users: {
          some: { role: 'admin', isActive: true, deletedAt: null },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('uses the oldest organisation only when no active-admin org exists', async () => {
    delete process.env.PUBLIC_ORG_SLUG;
    const { resolvePublicOrg } = loadPublicOrgModule();
    const prisma = {
      organisation: {
        findUnique: jest.fn(),
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'org_oldest' }),
      },
    };

    await expect(resolvePublicOrg(prisma as never)).resolves.toEqual({
      id: 'org_oldest',
    });
    expect(prisma.organisation.findFirst).toHaveBeenNthCalledWith(2, {
      orderBy: { createdAt: 'asc' },
    });
  });
});
