import { test, expect, type APIRequestContext } from '@playwright/test';

// PDF export coverage (Puppeteer, server-side). Verifies the schedule/weigh-in
// protocols render, the results protocol's signature-template precondition, and
// the full results PDF once a signature template exists.

const COMPLETED_SLUG = 'ge-national-spring-2026';

// Smallest valid PNG (1x1 transparent) — satisfies the signature data-URL regex.
const ONE_PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';

async function completedEventId(request: APIRequestContext): Promise<string> {
  const events = (await (await request.get('/api/events')).json()) as {
    id: string;
    slug: string;
  }[];
  const ev = events.find((e) => e.slug === COMPLETED_SLUG)!;
  return ev.id;
}

function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString('latin1') === '%PDF-';
}

test.describe('exports — Puppeteer PDFs', () => {
  test('schedule.pdf renders a valid PDF', async ({ request }) => {
    const eventId = await completedEventId(request);
    const res = await request.get(`/api/exports/${eventId}/schedule.pdf`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(isPdf(await res.body())).toBeTruthy();
  });

  test('weighin.pdf renders a valid PDF', async ({ request }) => {
    const eventId = await completedEventId(request);
    const res = await request.get(`/api/exports/${eventId}/weighin.pdf`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(isPdf(await res.body())).toBeTruthy();
  });

  test('results.pdf refuses without a templateId, renders with one', async ({
    request,
  }) => {
    const eventId = await completedEventId(request);

    // The results protocol must refuse to render unsigned: no ?templateId →
    // precise SIGNATURE_TEMPLATE_REQUIRED, never an unsigned document.
    const blocked = await request.get(`/api/exports/${eventId}/results.pdf`);
    expect(blocked.status()).toBe(400);
    expect(((await blocked.json()) as { code?: string }).code).toBe(
      'SIGNATURE_TEMPLATE_REQUIRED',
    );

    // Provide a head-judge signature template, then render with its id.
    const created = await request.post('/api/signature-templates', {
      data: {
        judgeNameEn: 'E2E Head Judge',
        judgeNameKa: 'მთავარი მსაჯი',
        signature: ONE_PX_PNG,
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const templateId = ((await created.json()) as { id: string }).id;

    const res = await request.get(
      `/api/exports/${eventId}/results.pdf?templateId=${templateId}`,
    );
    expect(res.status(), await res.text()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
    expect(isPdf(await res.body())).toBeTruthy();
  });
});
