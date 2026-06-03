#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// LIVE-FIGHT provisioner (idempotent) — builds the fixture the timer reliability
// test needs: an event in LIVE lifecycle with a real, startable bout.
//
// The mock seed only ships COMPLETED + REG_OPEN events, so there is nothing for
// timer-reliability.mjs to hammer out of the box. Doing it by hand means the
// whole tournament flow in the UI (register → approve → weigh-in → draw →
// publish → live). This script drives that same flow over the admin HTTP API,
// using the admin override at every gate, and prints the FIGHT_ID + EVENT_ID to
// feed straight into the timer test.
//
// It funnels a few same-sex athletes into ONE weight category and draws just
// that category, so the result is a clean bracket with at least one bout where
// both corners are real athletes (not a BYE).
//
//   1. docker compose up -d db
//   2. cd backend && SEED_MOCK_DATA=1 npm run prisma:seed   (once, if not seeded)
//   3. npm run loadtest:setup:live
//   4. npm run loadtest:timer        (auto-discovers the live fight)
//
// Safe to re-run: find-or-create everywhere; already-exists is swallowed.
// Everything is overridable via env (see CONFIG). Requires Node 18+.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  apiUrl: (process.env.API_URL ?? 'http://localhost:4000').replace(/\/+$/, ''),
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@geowushu.ge',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'Password123!',
  eventSlug: process.env.EVENT_SLUG ?? 'load-live-timer',
  eventName: process.env.EVENT_NAME ?? 'Load Test — Live Timer',
  templateName: process.env.TEMPLATE_NAME ?? 'Default Sanda Library',
  // How many athletes to funnel into the chosen category. Even number → all R1
  // bouts are real (no BYE). 2 = one bout; 4 = two semis + a final.
  athletes: Number(process.env.ATHLETES ?? 4),
};

const REASON = 'load-test live-fight provisioning';

// ── tiny cookie-aware HTTP client ───────────────────────────────────────────
let authCookie = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function http(method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (authCookie) headers.cookie = authCookie;
  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
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

async function must(method, path, body) {
  const res = await http(method, path, body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${method} ${path} → ${res.status} ${errCode(res)}`);
  }
  return res.body;
}

function errCode(res) {
  const b = res.body;
  if (typeof b === 'string') return b;
  return b?.code ?? b?.error ?? b?.message ?? `HTTP_${res.status}`;
}

function asList(body) {
  return Array.isArray(body) ? body : (body?.items ?? body?.registrations ?? []);
}

// ── steps ───────────────────────────────────────────────────────────────────
async function login() {
  const res = await http('POST', '/api/auth/login', {
    email: CONFIG.adminEmail,
    password: CONFIG.adminPassword,
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`login failed: ${res.status} ${errCode(res)}`);
  }
  authCookie = extractAuthCookie(res.raw);
  if (!authCookie) throw new Error('login ok but no gw_auth cookie');
  console.log(`✓ logged in as ${CONFIG.adminEmail}`);
}

async function findTemplateId() {
  const list = asList(await must('GET', '/api/category-templates'));
  const wanted = CONFIG.templateName.trim().toLowerCase();
  const match = list.find((t) => (t.name ?? '').trim().toLowerCase() === wanted);
  if (!match) throw new Error(`template "${CONFIG.templateName}" not found`);
  return match.id;
}

async function findOrCreateEvent() {
  const list = asList(await must('GET', '/api/events'));
  const existing = list.find((e) => e.slug === CONFIG.eventSlug);
  if (existing) {
    console.log(`✓ event exists: ${CONFIG.eventSlug} (id=${existing.id}, lifecycle=${existing.lifecycle})`);
    return {
      id: existing.id,
      lifecycle: existing.lifecycle,
      categoryTemplateId: existing.categoryTemplateId ?? null,
      competitionStartDate: existing.competitionStartDate,
    };
  }
  const templateId = await findTemplateId();
  // Dates set around "now" with a far-future end so the hourly stage-automation
  // never auto-completes the event out from under the test.
  const created = await must('POST', '/api/events', {
    name: CONFIG.eventName,
    slug: CONFIG.eventSlug,
    location: 'Tbilisi',
    timezone: 'Asia/Tbilisi',
    categoryTemplateId: templateId,
    // Order required by CreateEventSchema:
    //   regStart ≤ regEnd ≤ competitionStart ≤ competitionEnd
    //   weighInStart ≤ weighInEnd ≤ competitionStart
    // competitionStart sits just before "now" and competitionEnd is far future,
    // so the event reads as in-progress and stage-automation won't auto-complete it.
    dates: {
      registrationStartDate: '2026-05-20T00:00:00.000Z',
      registrationEndDate: '2026-05-25T00:00:00.000Z',
      weighInStartDate: '2026-05-26T08:00:00.000Z',
      weighInEndDate: '2026-05-28T12:00:00.000Z',
      competitionStartDate: '2026-05-30T00:00:00.000Z',
      competitionEndDate: '2026-12-31T00:00:00.000Z',
    },
  });
  console.log(`✓ created event ${CONFIG.eventSlug} (id=${created.id}, lifecycle=${created.lifecycle})`);
  return {
    id: created.id,
    lifecycle: created.lifecycle,
    categoryTemplateId: created.categoryTemplateId ?? templateId,
    competitionStartDate: created.competitionStartDate,
  };
}

async function ensureCategories(event) {
  let categories = await must('GET', `/api/events/${event.id}/categories`);
  if (!categories.ageGroups || categories.ageGroups.length === 0) {
    const templateId = categories.categoryTemplateId ?? event.categoryTemplateId;
    if (!templateId) throw new Error('event has no category template snapshot');
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
        weightName: wc.name,
        ageGroupName: ag.name,
        minAge: ag.minAge,
        maxAge: ag.maxAge,
      });
    }
  }
  return flat;
}

// Age the athlete will be on the event's competition start date. UTC-based,
// identical to the backend's computeAgeOnDate (registrations.service.ts) — so
// our eligibility check matches exactly what the register endpoint enforces.
function ageOnDate(dobISO, onISO) {
  const dob = new Date(dobISO);
  const on = new Date(onISO);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  const d = on.getUTCDate() - dob.getUTCDate();
  if (m < 0 || (m === 0 && d < 0)) age--;
  return age;
}

// Mirror of the backend's assertAthleteEligibleForCategory: sex must match, and
// the age-at-competition-start must sit inside [minAge, maxAge] — with the same
// youth→adult exception (a 15–17yo may enter an 18+ category). `override:true`
// bypasses windows + lifecycle but NOT this rule, so we must satisfy it here.
function isEligible(athlete, cat, competitionStartISO) {
  if (cat.sex && athlete.sex !== cat.sex) return false;
  if (!athlete.dateOfBirth) return false;
  const age = ageOnDate(athlete.dateOfBirth, competitionStartISO);
  const youthToAdult = age >= 15 && age <= 17 && cat.minAge === 18;
  if (age < cat.minAge && !youthToAdult) return false;
  if (age > cat.maxAge) return false;
  return true;
}

// Pick the first category with >= 2 athletes eligible by BOTH sex and age, and
// return that category + the athletes to funnel into it.
function pickCategoryAndAthletes(categories, athletes, competitionStartISO) {
  for (const cat of categories) {
    const pool = athletes.filter((a) => isEligible(a, cat, competitionStartISO));
    if (pool.length >= 2) {
      const n = Math.min(CONFIG.athletes, pool.length);
      const even = n - (n % 2); // keep it even so every R1 bout is real
      return { category: cat, chosen: pool.slice(0, Math.max(2, even)) };
    }
  }
  throw new Error('no category has >= 2 athletes eligible by age + sex');
}

async function registerAndApprove(event, category, chosen) {
  for (const a of chosen) {
    const reg = await http('POST', '/api/registrations', {
      eventId: event.id,
      athleteId: a.id,
      eventWeightCategoryId: category.eventWeightCategoryId,
      override: true,
      reason: REASON,
    });
    if (reg.status >= 300 && errCode(reg) !== 'REGISTRATION_ALREADY_EXISTS') {
      console.warn(`  ! register ${a.id} → ${errCode(reg)}`);
    }
  }
  // approve everything in this event (it's a dedicated event — every
  // registration here is one we just created, so no athlete-matching needed).
  const mine = asList(await must('GET', `/api/registrations?eventId=${event.id}`));
  for (const r of mine) {
    if (r.status === 'APPROVED') continue;
    const res = await http('POST', `/api/registrations/${r.id}/status`, {
      status: 'APPROVED',
      override: true,
      reason: REASON,
    });
    if (res.status >= 300) console.warn(`  ! approve ${r.id} → ${errCode(res)}`);
  }
  console.log(`✓ registered + approved ${mine.length} athletes into "${category.ageGroupName} / ${category.weightName}"`);
  return mine;
}

async function setLifecycle(event, to) {
  const res = await http('POST', `/api/events/${event.id}/lifecycle`, {
    to,
    override: true,
    reason: REASON,
  });
  if (res.status >= 300) {
    // tolerate "already there"
    const fresh = asList(await must('GET', '/api/events')).find((e) => e.id === event.id);
    if (fresh?.lifecycle !== to) {
      throw new Error(`lifecycle → ${to} failed: ${errCode(res)} (now ${fresh?.lifecycle})`);
    }
  }
  console.log(`✓ lifecycle → ${to}`);
}

async function weighInPass(regs) {
  for (const r of regs) {
    const res = await http('POST', '/api/weighin', {
      registrationId: r.id,
      weightKg: 70,
      decision: 'PASS',
      override: true,
      reason: REASON,
    });
    if (res.status >= 300) console.warn(`  ! weigh-in ${r.id} → ${errCode(res)}`);
  }
  console.log(`✓ recorded PASS weigh-ins for ${regs.length} athletes`);
}

async function runDraw(event) {
  const res = await http('POST', '/api/draw', {
    eventId: event.id,
    seed: 42,
    sameClubSeparation: false,
    override: true,
    reason: REASON,
  });
  if (res.status >= 300 && errCode(res) !== 'DRAW_ALREADY_EXISTS') {
    throw new Error(`draw failed: ${errCode(res)}`);
  }
  console.log(`✓ draw complete${errCode(res) === 'DRAW_ALREADY_EXISTS' ? ' (already drawn)' : ''}`);
}

async function findBout(event) {
  const fights = asList(await must('GET', `/api/fights?eventId=${event.id}`));
  const bouts = fights.filter((f) => f.redAthlete?.id && f.blueAthlete?.id);
  return { total: fights.length, bouts };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nProvisioning a LIVE fight against ${CONFIG.apiUrl}`);
  console.log('─'.repeat(64));

  await login();
  const event = await findOrCreateEvent();
  const categories = await ensureCategories(event);
  const athletes = asList(await must('GET', '/api/athletes'));
  console.log(`✓ loaded ${athletes.length} athletes, ${categories.length} weight categories`);

  // Age eligibility is computed against the event's competition start date.
  let competitionStart = event.competitionStartDate;
  if (!competitionStart) {
    const detail = await must('GET', `/api/events/${event.id}`);
    competitionStart = detail.competitionStartDate;
  }

  const { category, chosen } = pickCategoryAndAthletes(categories, athletes, competitionStart);
  console.log(
    `✓ chose "${category.ageGroupName} / ${category.weightName}" ` +
      `(${category.sex ?? 'any'}, age ${category.minAge}-${category.maxAge}) → ${chosen.length} eligible athletes`,
  );

  await setLifecycle(event, 'WEIGHIN');
  const regs = await registerAndApprove(event, category, chosen);
  await weighInPass(regs);
  await setLifecycle(event, 'WEIGH_IN_COMPLETED');
  await runDraw(event);
  await setLifecycle(event, 'PUBLISHED');
  await setLifecycle(event, 'LIVE');

  const { total, bouts } = await findBout(event);
  console.log('─'.repeat(64));
  if (!bouts.length) {
    console.log(`✗ event is LIVE but found no real bout (fights=${total}). Inspect the draw.`);
    process.exit(1);
  }
  const f = bouts[0];
  console.log('LIVE fixture ready.\n');
  console.log(`  EVENT_ID = ${event.id}`);
  console.log(`  FIGHT_ID = ${f.id}   (status ${f.status})`);
  console.log(`  bouts in event: ${bouts.length} of ${total} fights\n`);
  console.log('  Run the timer reliability test against it:');
  console.log(`    EVENT_ID=${event.id} FIGHT_ID=${f.id} npm run loadtest:timer`);
  console.log('  (or just: npm run loadtest:timer — it auto-discovers the LIVE fight)\n');
}

main().catch((err) => {
  console.error('\n✗ provisioning failed:', err.message);
  process.exit(1);
});
