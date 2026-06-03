#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Load-test fixture provisioner (idempotent).
//
// Builds a deterministic, WEIGHIN-stage event with configured categories and
// APPROVED, category-linked registrations so the k6 weigh-in scenarios have a
// realistic dataset to hammer (search + preview).
//
// Run this ONCE before a k6 run, after the DB has been seeded with mock data:
//
//   1. docker compose up -d db
//   2. cd backend && SEED_MOCK_DATA=1 npm run prisma:seed
//   3. node load-test/setup.mjs            (or: npm run loadtest:setup)
//
// It only talks to the public HTTP API as an admin — no direct DB access — so
// it exercises the exact same code paths the real admin UI uses, and is safe to
// re-run (find-or-create everywhere; already-exists errors are swallowed).
//
// Everything is overridable via env (see CONFIG). The k6 scripts discover the
// event by the SAME slug, so the only contract between this script and k6 is
// EVENT_SLUG.
//
// Requires Node 18+ (global fetch + Headers.getSetCookie).
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  apiUrl: (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, ''),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@geowushu.ge',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'Password123!',
  eventSlug: process.env.EVENT_SLUG ?? 'load-weighin-stress',
  eventName: process.env.EVENT_NAME ?? 'Load Test — Weigh-in Stress',
  templateName: process.env.TEMPLATE_NAME ?? 'Default Sanda Library',
  // competitionStartDate drives athlete-age eligibility (computeAgeOnDate).
  // Keep it aligned with the seeded athletes' DOBs (early 2026).
  competitionStart: process.env.COMPETITION_START ?? '2026-01-15T00:00:00.000Z',
};

const REASON = 'load-test provisioning';
const MAX_RETRIES = 8;

// ── tiny HTTP client with cookie + 429-aware retry ──────────────────────────

let authCookie = null; // "gw_auth=<token>"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extract the gw_auth cookie from a login response across Node versions.
function extractAuthCookie(res) {
  const jar =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')].filter(Boolean);
  for (const line of jar) {
    const m = /(^|[;,\s])gw_auth=([^;]+)/.exec(line ?? '');
    if (m) return `gw_auth=${m[2]}`;
  }
  return null;
}

// One HTTP call. Retries on 429 (honoring Retry-After) and on transient 5xx.
// Returns { status, body }. Never throws on HTTP status — callers decide.
async function http(method, path, body, { retries = MAX_RETRIES } = {}) {
  const url = path.startsWith('http') ? path : `${CONFIG.apiUrl}${path}`;
  for (let attempt = 0; ; attempt++) {
    const headers = { 'content-type': 'application/json' };
    if (authCookie) headers.cookie = authCookie;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual',
      });
    } catch (err) {
      if (attempt >= retries) throw err;
      const backoff = Math.min(2000 * 2 ** attempt, 15000);
      console.warn(`  ↻ network error on ${method} ${path}: ${err.message} — retry in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** attempt, 15000);
      console.warn(`  ↻ ${res.status} on ${method} ${path} — retry in ${backoff}ms (attempt ${attempt + 1})`);
      await sleep(backoff);
      continue;
    }

    let parsed = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed, raw: res };
  }
}

// Like http() but throws a rich error on non-2xx. Use for "must succeed" calls.
async function must(method, path, body, opts) {
  const res = await http(method, path, body, opts);
  if (res.status < 200 || res.status >= 300) {
    const code = res.body?.code ?? res.body?.error ?? res.body?.message ?? '';
    throw new Error(`${method} ${path} → ${res.status} ${typeof code === 'string' ? code : JSON.stringify(res.body)}`);
  }
  return res.body;
}

// Returns the server error code (snake_case) for a non-2xx, else null.
function errorCode(res) {
  if (res.status >= 200 && res.status < 300) return null;
  const b = res.body;
  if (typeof b === 'string') return b;
  return b?.code ?? b?.error ?? b?.message ?? `HTTP_${res.status}`;
}

// ── eligibility (mirror of registrations.service.ts) ────────────────────────

function ageOnDate(dobISO, onISO) {
  const dob = new Date(dobISO);
  const on = new Date(onISO);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = on.getUTCDate() - dob.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age--;
  return age;
}

function isEligible(athlete, category, competitionStart) {
  if (!athlete.dateOfBirth) return false;
  const age = ageOnDate(athlete.dateOfBirth, competitionStart);
  const youthToAdult = age >= 15 && age <= 17 && category.minAge === 18;
  if (category.minAge != null && age < category.minAge && !youthToAdult) return false;
  if (category.maxAge != null && age > category.maxAge) return false;
  if (category.sex && athlete.sex && category.sex !== athlete.sex) return false;
  return true;
}

// ── steps ───────────────────────────────────────────────────────────────────

async function login() {
  const res = await http('POST', '/api/auth/login', {
    email: CONFIG.adminEmail,
    password: CONFIG.adminPassword,
  });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  authCookie = extractAuthCookie(res.raw);
  if (!authCookie) throw new Error('login succeeded but no gw_auth cookie was returned');
  console.log(`✓ logged in as ${CONFIG.adminEmail} (role=${res.body?.role ?? '?'})`);
}

async function findTemplateId() {
  const templates = await must('GET', '/api/category-templates');
  const list = Array.isArray(templates) ? templates : (templates.items ?? []);
  const wanted = CONFIG.templateName.trim().toLowerCase();
  const match = list.find((t) => (t.name ?? '').trim().toLowerCase() === wanted);
  if (!match) {
    const names = list.map((t) => t.name).join(', ') || '(none)';
    throw new Error(`category template "${CONFIG.templateName}" not found. Available: ${names}`);
  }
  return match.id;
}

async function findOrCreateEvent() {
  const events = await must('GET', '/api/events');
  const list = Array.isArray(events) ? events : (events.items ?? []);
  const existing = list.find((e) => e.slug === CONFIG.eventSlug);
  if (existing) {
    console.log(`✓ event exists: ${CONFIG.eventSlug} (id=${existing.id}, lifecycle=${existing.lifecycle})`);
    return { id: existing.id, lifecycle: existing.lifecycle, categoryTemplateId: existing.categoryTemplateId ?? null };
  }

  const templateId = await findTemplateId();
  const compStart = CONFIG.competitionStart;
  const created = await must('POST', '/api/events', {
    name: CONFIG.eventName,
    slug: CONFIG.eventSlug,
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    categoryTemplateId: templateId,
    dates: {
      registrationStartDate: '2025-12-01T00:00:00.000Z',
      registrationEndDate: '2026-01-10T00:00:00.000Z',
      weighInStartDate: '2026-01-14T08:00:00.000Z',
      weighInEndDate: '2026-01-14T12:00:00.000Z',
      competitionStartDate: compStart,
      competitionEndDate: '2026-01-16T00:00:00.000Z',
    },
  });
  console.log(`✓ created event ${CONFIG.eventSlug} (id=${created.id}, lifecycle=${created.lifecycle})`);
  return { id: created.id, lifecycle: created.lifecycle, categoryTemplateId: created.categoryTemplateId ?? templateId };
}

// Ensure the event's category graph (EventAgeGroup + EventWeightCategory) is
// built. Returns the flat list of eligible categories for matching.
async function ensureCategories(event) {
  let categories = await must('GET', `/api/events/${event.id}/categories`);

  if (!categories.ageGroups || categories.ageGroups.length === 0) {
    const templateId = categories.categoryTemplateId ?? event.categoryTemplateId;
    if (!templateId) throw new Error('event has no category template snapshot — cannot build categories');

    const detail = await must('GET', `/api/category-templates/${templateId}`);
    const selection = {
      categoryTemplateId: templateId,
      ageGroups: (detail.ageGroups ?? [])
        .map((ag) => ({
          categoryTemplateGroupId: ag.id,
          weightCategoryIds: (ag.weightCategories ?? []).map((w) => w.id),
        }))
        .filter((g) => g.weightCategoryIds.length > 0),
    };
    if (selection.ageGroups.length === 0) {
      throw new Error(`template ${templateId} has no weight categories to select`);
    }
    await must('POST', `/api/events/${event.id}/categories`, selection);
    categories = await must('GET', `/api/events/${event.id}/categories`);
    console.log(`✓ configured categories: ${categories.ageGroups.length} age groups`);
  } else {
    console.log(`✓ categories already configured: ${categories.ageGroups.length} age groups`);
  }

  const flat = [];
  for (const ag of categories.ageGroups) {
    for (const wc of ag.weightCategories) {
      flat.push({
        eventWeightCategoryId: wc.id,
        sex: ag.sex,
        minAge: ag.minAge,
        maxAge: ag.maxAge,
        ageGroupName: ag.name,
        weightName: wc.name,
      });
    }
  }
  console.log(`  → ${flat.length} weight categories available`);
  return flat;
}

async function registerAthletes(event, categories) {
  const athletes = await must('GET', '/api/athletes');
  const list = Array.isArray(athletes) ? athletes : (athletes.items ?? []);
  console.log(`✓ loaded ${list.length} athletes`);

  let created = 0;
  let already = 0;
  let unmatched = 0;
  let failed = 0;

  for (const athlete of list) {
    const cat = categories.find((c) => isEligible(athlete, c, CONFIG.competitionStart));
    if (!cat) {
      unmatched++;
      continue;
    }
    const res = await http('POST', '/api/registrations', {
      eventId: event.id,
      athleteId: athlete.id,
      eventWeightCategoryId: cat.eventWeightCategoryId,
      override: true,
      reason: REASON,
    });
    if (res.status >= 200 && res.status < 300) {
      created++;
    } else if (errorCode(res) === 'REGISTRATION_ALREADY_EXISTS') {
      already++;
    } else {
      failed++;
      if (failed <= 5) console.warn(`  ! register athlete ${athlete.id} failed: ${errorCode(res)}`);
    }
  }
  console.log(`✓ registrations: ${created} created, ${already} already existed, ${unmatched} unmatched, ${failed} failed`);
  return created + already;
}

async function approveRegistrations(event) {
  const regs = await must('GET', `/api/registrations?eventId=${event.id}`);
  const list = Array.isArray(regs) ? regs : (regs.items ?? regs.registrations ?? []);
  let approved = 0;
  let alreadyApproved = 0;
  let failed = 0;

  for (const reg of list) {
    if (reg.status === 'APPROVED') {
      alreadyApproved++;
      continue;
    }
    const res = await http('POST', `/api/registrations/${reg.id}/status`, {
      status: 'APPROVED',
      override: true,
      reason: REASON,
    });
    if (res.status >= 200 && res.status < 300) approved++;
    else {
      failed++;
      if (failed <= 5) console.warn(`  ! approve ${reg.id} failed: ${errorCode(res)}`);
    }
  }
  console.log(`✓ approvals: ${approved} approved now, ${alreadyApproved} already approved, ${failed} failed`);
  return approved + alreadyApproved;
}

async function moveToWeighin(event) {
  if (event.lifecycle === 'WEIGHIN') {
    console.log('✓ event already in WEIGHIN');
    return;
  }
  const res = await http('POST', `/api/events/${event.id}/lifecycle`, {
    to: 'WEIGHIN',
    override: true,
    reason: REASON,
  });
  if (res.status >= 200 && res.status < 300) {
    console.log(`✓ lifecycle → WEIGHIN (was ${event.lifecycle})`);
  } else {
    // Re-fetch to see whether it's effectively there anyway.
    const events = await must('GET', '/api/events');
    const fresh = (Array.isArray(events) ? events : []).find((e) => e.id === event.id);
    if (fresh?.lifecycle === 'WEIGHIN') {
      console.log('✓ event is in WEIGHIN');
    } else {
      throw new Error(`failed to move to WEIGHIN: ${errorCode(res)} (current=${fresh?.lifecycle})`);
    }
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nProvisioning load-test fixtures against ${CONFIG.apiUrl}`);
  console.log('─'.repeat(60));

  await login();
  const event = await findOrCreateEvent();
  const categories = await ensureCategories(event);
  await registerAthletes(event, categories);
  await approveRegistrations(event);
  await moveToWeighin(event);

  console.log('─'.repeat(60));
  console.log('Fixture ready.');
  console.log(`  EVENT_SLUG = ${CONFIG.eventSlug}`);
  console.log(`  eventId    = ${event.id}`);
  console.log('  k6 discovers the event by slug — just run a profile next.\n');
}

main().catch((err) => {
  console.error('\n✗ provisioning failed:', err.message);
  process.exit(1);
});
