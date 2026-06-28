import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { ADMIN, loginViaApi } from './auth';

// ──────────────────────────────────────────────────────────────────────────
// Seeder — bulk creation through the REAL API with the admin auth cookie.
//
// Two hazards this wraps around:
//   • gw_auth expires after 15 min and the APIRequestContext does NOT
//     auto-refresh like the app's apiClient. So every call re-logs-in on 401
//     and retries once (the request context's cookie jar is updated in place).
//   • Bulk volume (≈1500 calls to reach 400 athletes) trips the throttler
//     (120 req/min + a short 10 req/10s bucket) UNLESS the backend runs with
//     THROTTLE_DISABLED=1 (the documented load-testing escape hatch — see the
//     README). To stay correct either way, a 429 is retried with backoff that
//     honours Retry-After. With the throttler on, the seed merely runs slower;
//     it never fails for rate-limiting alone.
// ──────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

export class Seeder {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string,
  ) {}

  // Core request with 401-relogin + 429-backoff.
  private async call(
    method: 'get' | 'post' | 'delete',
    url: string,
    data?: Json,
  ): Promise<APIResponse> {
    let reloggedIn = false;
    let throttleTries = 0;
    // State-changing requests carrying an Origin must match the CORS allow-list
    // (OriginCheckMiddleware); mirror a real browser by always sending it.
    const headers = { origin: this.baseURL };

    for (;;) {
      const res = await this.request[method](url, {
        headers,
        ...(data !== undefined ? { data } : {}),
      });

      if (res.status() === 401 && !reloggedIn) {
        reloggedIn = true;
        await loginViaApi(this.request, this.baseURL, ADMIN);
        continue; // retry once with a fresh cookie
      }

      if (res.status() === 429 && throttleTries < 12) {
        throttleTries += 1;
        const retryAfter = Number(res.headers()['retry-after']);
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(10_000, 500 * 2 ** throttleTries);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      return res;
    }
  }

  get(url: string) {
    return this.call('get', url);
  }
  post(url: string, data?: Json) {
    return this.call('post', url, data);
  }
  del(url: string) {
    return this.call('delete', url);
  }

  /** POST and assert a <400 status, surfacing the body on failure. */
  async postOk(url: string, data?: Json): Promise<APIResponse> {
    const res = await this.post(url, data);
    expect(res.ok(), `POST ${url} → ${res.status()}: ${await res.text()}`).toBeTruthy();
    return res;
  }

  /** GET and parse JSON (asserts ok). */
  async getJson<T = unknown>(url: string): Promise<T> {
    const res = await this.get(url);
    expect(res.ok(), `GET ${url} → ${res.status()}: ${await res.text()}`).toBeTruthy();
    return (await res.json()) as T;
  }

  // ── Geography / clubs / users ────────────────────────────────────────────

  async createCountry(body: { name: string; nameKa?: string | null; code?: string | null }) {
    return (await (await this.postOk('/api/countries', body)).json()) as { id: string };
  }

  async createRegion(body: { countryId: string; name: string; nameKa?: string | null }) {
    return (await (await this.postOk('/api/regions', body)).json()) as { id: string };
  }

  async createClub(body: {
    name: string;
    nameKa?: string | null;
    regionId: string;
    city?: string | null;
  }) {
    return (await (await this.postOk('/api/clubs', body)).json()) as { id: string };
  }

  async createCoach(body: {
    email: string;
    password: string;
    displayName: string;
    clubId: string;
    nationality: 'GE' | null;
  }) {
    return this.postOk('/api/admin/users', {
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: 'coach',
      clubId: body.clubId,
      nationality: body.nationality,
    });
  }

  // ── Athletes / registrations ───────────────────────────────────────────────

  async createAthlete(body: Json): Promise<{ id: string }> {
    const res = await this.postOk('/api/athletes', body);
    const json = (await res.json()) as { athlete: { id: string } };
    return json.athlete;
  }

  async register(body: {
    eventId: string;
    athleteId: string;
    eventWeightCategoryId: string;
  }): Promise<{ id: string }> {
    const res = await this.postOk('/api/registrations', body);
    const json = (await res.json()) as { id?: string; registration?: { id: string } };
    const id = json.id ?? json.registration?.id;
    expect(id, 'registration response carries an id').toBeTruthy();
    return { id: id! };
  }

  /** Force a single registration to a status (override-tolerant). */
  async setRegStatus(registrationId: string, status: string) {
    let res = await this.post(`/api/registrations/${registrationId}/status`, { status });
    if (!res.ok()) {
      res = await this.postOk(`/api/registrations/${registrationId}/status`, {
        status,
        override: true,
        reason: 'e2e',
      });
    }
    return res;
  }

  /** Bulk status transition — far fewer calls than per-row. */
  async bulkStatus(status: string, registrationIds: string[], reason?: string) {
    return this.postOk('/api/registrations/bulk-status', {
      status,
      registrationIds,
      ...(reason ? { reason } : {}),
    });
  }

  // ── Weigh-in ───────────────────────────────────────────────────────────────

  async weighIn(body: Json) {
    let res = await this.post('/api/weighin', body);
    if (!res.ok()) {
      res = await this.postOk('/api/weighin', { ...body, override: true, reason: 'e2e' });
    }
    return res;
  }

  // ── Draw / brackets / fights ────────────────────────────────────────────────

  async runDraw(eventId: string) {
    let res = await this.post('/api/draw', { eventId });
    if (!res.ok()) {
      res = await this.postOk('/api/draw', { eventId, override: true, reason: 'e2e' });
    }
    return res;
  }

  async getBrackets(eventId: string) {
    return this.getJson<Array<Record<string, unknown>>>(`/api/brackets?eventId=${eventId}`);
  }

  async getFights(eventId: string) {
    const j = await this.getJson<unknown>(`/api/fights?eventId=${eventId}`);
    return (Array.isArray(j) ? j : (j as { fights?: unknown[] }).fights ?? []) as Array<
      Record<string, any>
    >;
  }

  /** Resolve one fight deterministically through the normal LIVE_RUN path. */
  async finishFight(fightId: string, winner: 'RED' | 'BLUE', method = 'POINTS') {
    await this.post(`/api/fights/${fightId}/start`);
    await this.post(`/api/fights/${fightId}/timer`, { action: 'START', round: 1 });
    const body: Json = { winner, method };
    if (method === 'DQ') body.dqReason = 'Illegal technique';
    return this.postOk(`/api/fights/${fightId}/finish`, body);
  }

  // ── Schedule / mats / sessions ──────────────────────────────────────────────

  async createMat(eventId: string, name: string, order: number) {
    return this.postOk('/api/mats', { eventId, name, order });
  }

  async createSession(eventId: string, name: string, startTime: string, endTime: string) {
    return this.postOk('/api/schedule-sessions', { eventId, name, startTime, endTime });
  }

  async generateSchedule(eventId: string, avgBoutSeconds = 180, bufferSeconds = 60) {
    return this.postOk('/api/schedule/generate', { eventId, avgBoutSeconds, bufferSeconds });
  }

  // ── Events / categories / lifecycle ─────────────────────────────────────────

  async createEvent(body: Json): Promise<{ id: string; lifecycle: string }> {
    const res = await this.post('/api/events', body);
    expect(res.status(), await res.text()).toBe(201);
    return (await res.json()) as { id: string; lifecycle: string };
  }

  async getEventCategoriesMeta(eventId: string) {
    return this.getJson<{ categoryTemplateId: string; ageGroups: any[] }>(
      `/api/events/${eventId}/categories`,
    );
  }

  async getTemplateCategories(templateId: string) {
    return this.getJson<any[]>(`/api/category-templates/${templateId}/categories`);
  }

  async selectEventCategories(
    eventId: string,
    categoryTemplateId: string,
    ageGroups: Array<{ categoryTemplateGroupId: string; weightCategoryIds: string[] }>,
  ) {
    return this.postOk(`/api/events/${eventId}/categories`, { categoryTemplateId, ageGroups });
  }

  async getLifecycle(eventId: string): Promise<string> {
    const ev = await this.getJson<{ lifecycle: string }>(`/api/events/${eventId}`);
    return ev.lifecycle;
  }

  /** API lifecycle advance (used only to set preconditions, never as the
   *  primary assertion — the UI advance is the asserted path). */
  async advanceLifecycle(eventId: string, to: string, order: string[]) {
    const cur = await this.getLifecycle(eventId);
    if (order.indexOf(cur) >= order.indexOf(to)) return; // auto-advanced past it
    let res = await this.post(`/api/events/${eventId}/lifecycle`, { to });
    if (!res.ok()) {
      res = await this.post(`/api/events/${eventId}/lifecycle`, {
        to,
        override: true,
        reason: 'e2e',
      });
    }
    expect(res.ok(), `lifecycle ${cur}->${to}: ${await res.text()}`).toBeTruthy();
  }

  // ── Results / exports / signatures ──────────────────────────────────────────

  async createSignatureTemplate(judgeNameEn: string, judgeNameKa: string, signature: string) {
    const res = await this.postOk('/api/signature-templates', {
      judgeNameEn,
      judgeNameKa,
      signature,
    });
    return (await res.json()) as { id: string };
  }

  async getResults(eventId: string) {
    return this.getJson<Array<Record<string, unknown>>>(`/api/results?eventId=${eventId}`);
  }

  async getResultsSummary(eventId: string) {
    return this.getJson<{ medalTable?: any[] }>(`/api/results/summary?eventId=${eventId}`);
  }

  async deleteEvent(eventId: string) {
    return this.del(`/api/events/${eventId}`).catch(() => undefined);
  }
}

// Bounded-concurrency map — keeps the seed fast without firing 400 requests at
// once (which would hammer the dev server and trip the short throttle bucket
// even harder). Preserves input order in the result.
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
