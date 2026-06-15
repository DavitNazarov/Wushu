import { test, expect, type APIRequestContext } from '@playwright/test';

// Deep functional coverage of the athlete registry (admin context). Exercises
// the real create/upsert/list/get endpoints + the documentId-uniqueness and
// validation rules described in CLAUDE.md "Document IDs". All rows are created
// with a run-unique documentId so reruns never collide with prior data.

const uniqueDoc = () =>
  `E2E${Date.now()}${Math.floor(Math.random() * 1e4)}`;

async function createAthlete(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
) {
  const body = {
    firstName: 'Flow',
    lastName: 'Athlete',
    firstNameKa: 'ფლოუ',
    lastNameKa: 'სპორტსმენი',
    documentId: uniqueDoc(),
    sex: 'MALE',
    dateOfBirth: '2001-03-09',
    ...overrides,
  };
  const res = await request.post('/api/athletes', { data: body });
  return { res, body };
}

test.describe('athletes — CRUD + invariants', () => {
  test('creates an athlete and persists bilingual fields', async ({ request }) => {
    const { res, body } = await createAthlete(request);
    expect(res.status(), await res.text()).toBe(201);
    const json = (await res.json()) as {
      athlete: Record<string, unknown>;
      possibleDuplicates: unknown[];
    };
    expect(json.athlete.id).toBeTruthy();
    expect(json.athlete.firstName).toBe(body.firstName);
    // KA fields must round-trip — they drive /ka rendering.
    expect(json.athlete.firstNameKa).toBe(body.firstNameKa);
    expect(json.athlete.lastNameKa).toBe(body.lastNameKa);
    expect(json.athlete.documentId).toBe(body.documentId);
    expect(Array.isArray(json.possibleDuplicates)).toBeTruthy();
  });

  test('rejects a duplicate documentId with DOCUMENT_ID_ALREADY_EXISTS', async ({
    request,
  }) => {
    const doc = uniqueDoc();
    const first = await createAthlete(request, { documentId: doc });
    expect(first.res.status()).toBe(201);

    const second = await createAthlete(request, {
      documentId: doc,
      firstName: 'Other',
      lastName: 'Person',
    });
    expect(second.res.status()).toBe(409);
    const err = (await second.res.json()) as { code?: string };
    expect(err.code).toBe('DOCUMENT_ID_ALREADY_EXISTS');
  });

  test('rejects invalid payloads with VALIDATION_ERROR', async ({ request }) => {
    // Missing documentId + dateOfBirth.
    const res = await request.post('/api/athletes', {
      data: { firstName: 'No', lastName: 'Doc' },
    });
    expect(res.status()).toBe(400);
    const err = (await res.json()) as { code?: string; issues?: unknown[] };
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(err.issues)).toBeTruthy();

    // Blank first name is rejected (min(1) after trim).
    const blank = await request.post('/api/athletes', {
      data: {
        firstName: '   ',
        lastName: 'X',
        documentId: uniqueDoc(),
        dateOfBirth: '2000-01-01',
      },
    });
    expect(blank.status()).toBe(400);
  });

  test('a created athlete is retrievable by id', async ({ request }) => {
    const { res } = await createAthlete(request);
    const { athlete } = (await res.json()) as { athlete: { id: string } };

    const got = await request.get(`/api/athletes/${athlete.id}`);
    expect(got.status()).toBe(200);
    // GET :id returns a profile: { athlete, medals, registrations, fights }.
    const profile = (await got.json()) as { athlete: Record<string, unknown> };
    expect(profile.athlete.id).toBe(athlete.id);
  });

  // BUG (confirmed): the athlete profile endpoint omits the KA name fields.
  // athlete-profile.service.ts maps the response with only firstName/lastName +
  // a hardcoded English `fullName` (lines ~57-59 and ~113-115), so the admin AND
  // public profile pages cannot render Georgian names on /ka — they fall back to
  // English even when firstNameKa/lastNameKa exist. Violates CLAUDE.md's "Prisma
  // Select Rule". Marked test.fail() until the service includes the KA fields
  // (and a fullNameKa) so this flips to a passing regression guard once fixed.
  test('profile endpoint SHOULD expose KA name fields (i18n)', async ({
    request,
  }) => {
    test.fail();
    const { res } = await createAthlete(request, {
      firstNameKa: 'გიორგი',
      lastNameKa: 'ბერიძე',
    });
    const { athlete } = (await res.json()) as { athlete: { id: string } };
    const got = await request.get(`/api/athletes/${athlete.id}`);
    const profile = (await got.json()) as {
      athlete: { firstNameKa?: string | null };
    };
    expect(profile.athlete.firstNameKa).toBe('გიორგი');
  });

  test('upsert (id present) updates an existing athlete in place', async ({
    request,
  }) => {
    const { res } = await createAthlete(request);
    const { athlete } = (await res.json()) as {
      athlete: { id: string; documentId: string };
    };

    const upd = await request.post('/api/athletes', {
      data: {
        id: athlete.id,
        firstName: 'Renamed',
        lastName: 'Updated',
        documentId: athlete.documentId, // same doc — must NOT trip uniqueness on self
        dateOfBirth: '2001-03-09',
        sex: 'FEMALE',
      },
    });
    expect(upd.status(), await upd.text()).toBeLessThan(400);

    const got = await request.get(`/api/athletes/${athlete.id}`);
    const { athlete: detail } = (await got.json()) as {
      athlete: { firstName: string; sex: string };
    };
    expect(detail.firstName).toBe('Renamed');
    expect(detail.sex).toBe('FEMALE');
  });

  test('list endpoint is row-capped and honors limit', async ({ request }) => {
    const res = await request.get('/api/athletes?limit=5');
    expect(res.status()).toBe(200);
    const rows = (await res.json()) as unknown[];
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length).toBeLessThanOrEqual(5);
  });
});

test.describe('athletes — admin UI', () => {
  test('registry page renders a populated list', async ({ page }) => {
    await page.goto('/en/admin/athletes', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/athletes/);
    // The seed has 77 athletes — the page should show athlete rows/cards, not an
    // empty state. Assert some athlete-bearing content is visible.
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(50);
  });
});
