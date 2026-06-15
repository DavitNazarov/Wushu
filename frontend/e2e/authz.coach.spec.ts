import { test, expect, type APIRequestContext } from '@playwright/test';

// Authorization matrix for the coach role (capabilities = ATHLETES_MANAGE only).
// Runs in the 'coach' project (coach storageState). Verifies vertical privilege
// (no admin-only endpoint) and horizontal privilege (own-club scoping is forced
// server-side and cannot be bypassed via crafted clubId / cross-club mutation).

async function coachClubId(request: APIRequestContext): Promise<string> {
  const me = await (await request.get('/api/auth/me')).json();
  return me.clubId as string;
}

test.describe('coach authz — vertical privilege (admin-only endpoints denied)', () => {
  const FORBIDDEN: Array<[string, 'GET' | 'POST', string]> = [
    ['GET', 'GET', '/api/admin/users'],
    ['POST', 'POST', '/api/events'],
    ['POST', 'POST', '/api/draw'],
    ['POST', 'POST', '/api/weighin'],
    ['POST', 'POST', '/api/schedule/generate'],
    ['POST', 'POST', '/api/clubs'],
    ['POST', 'POST', '/api/countries'],
  ];

  for (const [, method, path] of FORBIDDEN) {
    test(`${method} ${path} is forbidden`, async ({ request }) => {
      const res =
        method === 'GET'
          ? await request.get(path)
          : await request.post(path, { data: {} });
      expect(
        [401, 403],
        `expected auth failure for ${method} ${path}, got ${res.status()}`,
      ).toContain(res.status());
    });
  }
});

test.describe('coach authz — horizontal privilege (own-club scoping)', () => {
  test('athlete list returns only the coach own club', async ({ request }) => {
    const res = await request.get('/api/athletes?limit=500');
    expect(res.status()).toBe(200);
    const rows = (await res.json()) as { club?: { name?: string } | null }[];
    const clubs = new Set(
      rows.map((r) => r.club?.name).filter((n): n is string => !!n),
    );
    expect(
      clubs.size,
      `coach saw multiple clubs: ${[...clubs].join(', ')}`,
    ).toBeLessThanOrEqual(1);
  });

  test('creating an athlete with a foreign clubId is forced to own club', async ({
    request,
  }) => {
    const myClub = await coachClubId(request);
    // Find a different club via the public listing (anonymous-readable).
    const clubs = (await (await request.get('/api/public/clubs')).json()) as {
      id: string;
    }[];
    const otherClub = clubs.find((c) => c.id !== myClub);
    expect(otherClub, 'need a second club in the seed').toBeTruthy();

    const res = await request.post('/api/athletes', {
      data: {
        firstName: 'Scoped',
        lastName: 'Athlete',
        firstNameKa: 'სქ',
        lastNameKa: 'ათ',
        documentId: `11${Date.now()}`,
        dateOfBirth: '2002-02-02',
        clubId: otherClub!.id, // attempt to plant in another club
      },
    });
    expect(res.status()).toBe(201);
    const { athlete } = (await res.json()) as { athlete: { clubId: string } };
    // Server ignores the crafted clubId and forces the coach's own club.
    expect(athlete.clubId).toBe(myClub);
  });

  test('cannot mutate an athlete belonging to another club', async ({
    request,
  }) => {
    const myClub = await coachClubId(request);
    const clubs = (await (await request.get('/api/public/clubs')).json()) as {
      id: string;
    }[];
    const otherClub = clubs.find((c) => c.id !== myClub);
    expect(otherClub).toBeTruthy();

    // Pull a victim athlete id from the other club's public roster.
    const otherDetail = (await (
      await request.get(`/api/public/clubs/${otherClub!.id}`)
    ).json()) as { athletes?: { id: string }[] };
    const victim = otherDetail.athletes?.[0];
    test.skip(!victim, 'other club has no athletes to attempt mutation on');

    const res = await request.post('/api/athletes', {
      data: {
        id: victim!.id,
        firstName: 'HACKED',
        lastName: 'X',
        documentId: `99${Date.now()}`,
        dateOfBirth: '2000-01-01',
      },
    });
    expect(
      [401, 403],
      `coach mutated a foreign athlete (status ${res.status()})`,
    ).toContain(res.status());
  });
});

test.describe('coach authz — browser routes', () => {
  test('admin pages redirect coach to no-access/login', async ({ page }) => {
    await page.goto('/en/admin/users');
    await expect(page).toHaveURL(/\/no-access|\/login/);
  });
});
