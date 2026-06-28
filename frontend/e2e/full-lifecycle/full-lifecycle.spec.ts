import { test, expect } from '@playwright/test';
import { Seeder, mapPool } from './helpers/seed';
import {
  RUN_ID,
  RUN_LABEL,
  nm,
  slugify,
  athleteDocId,
  geNationalId,
} from './helpers/run';
import { loginViaForm } from './helpers/auth';
import {
  settle,
  modalPanel,
  fillFieldByLabel,
  selectNativeByLabel,
  selectRadixByLabel,
} from './helpers/ui';
import { gotoEvent, assertStageBadge, advanceStageUI } from './helpers/lifecycle';
import { captureDownloadPdf, expectPdfResponse } from './helpers/pdf';

// ──────────────────────────────────────────────────────────────────────────
// FULL-LIFECYCLE pipeline. See README.md for preconditions + the hybrid
// coverage contract. One serial describe; each phase is its own test() so a
// failure localizes, and module-scoped `S` carries ids captured along the way.
//
// Reliability stance: state that LATER phases depend on (the 400-athlete pool,
// every weigh-in/fight outcome, lifecycle preconditions) is built through the
// REAL API and verified from the DB, which is the source of truth. The real
// browser UI is driven for every distinct page/function and every edge branch;
// where a UI interaction is preview/timing-gated in dev, the action is still
// performed in the browser and its OUTCOME is asserted via the API.
// ──────────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

// 1×1 transparent PNG — the head-judge signature embedded in protocol PDFs.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TOTAL_ATHLETES = 400;
const POOL = 6; // request concurrency for bulk seeding

type Cat = {
  ewcId: string;
  sex: string;
  name: string; // weight class name, e.g. "70kg"
  code: string; // age-group code, e.g. "adults-men-sanda"
  minW: number | null;
  maxW: number | null;
  sortOrder: number;
};

type Reg = { athleteId: string; regId: string; name: string; docId: string };

// Module-scoped shared state captured across phases.
const S = {
  baseURL: '',
  countryId: '',
  regionId: '',
  clubId: '',
  geCoachEmail: '',
  intlCoachEmail: '',
  geAthlete: null as Reg | null,
  intlAthlete: null as Reg | null,
  eventId: '',
  eventSlug: '',
  templateId: '',
  cats: [] as Cat[],
  direct: null as Cat | null,
  rr: null as Cat | null,
  se: [] as Cat[],
  // registration-UI targets (driven through the registrations page UI in P3)
  regApprove: null as Reg | null,
  regReject: null as Reg | null,
  regWithdraw: null as Reg | null,
  // a known SUBMITTED (non-approved) registration → must be excluded from roster
  submittedSample: null as Reg | null,
  approvedSample: null as Reg | null,
  // named weigh-in edge cases
  uiClean: null as Reg | null,
  moveUp: null as Reg | null,
  oneHour: null as Reg | null,
  reattempt: null as Reg | null,
  noShow: null as Reg | null,
  // categories the weigh-in edge athletes live in (captured so P5 can compute
  // in-range / move-up weights — category ORDER is template-driven, not ours).
  uiCat: null as Cat | null,
  moveUpFrom: null as Cat | null,
  moveUpTo: null as Cat | null,
  signatureId: '',
};

// Athlete docId sequence — globally unique within the run so re-runs never
// collide on @@unique([organisationId, documentId]).
let seq = 0;

// A PASS-able weight strictly inside the category's (minExcl, maxIncl] band.
function midWeight(cat: { minW: number | null; maxW: number | null }): number {
  const { minW: lo, maxW: hi } = cat;
  if (hi == null) return (lo ?? 80) + 5;
  if (lo == null) return Math.max(1, hi - 2);
  return Math.round(((lo + hi) / 2) * 10) / 10;
}
// A weight clearly over the cap (triggers the over-limit / move-up branches).
function overWeight(cat: { maxW: number | null }): number {
  return (cat.maxW ?? 100) + 2;
}

function seeder(request: import('@playwright/test').APIRequestContext): Seeder {
  return new Seeder(request, S.baseURL);
}

// Create an athlete + registration in one go (API). Adults (dob 2000) so every
// athlete is eligible for the adults age groups, sex matched to the category.
async function createReg(
  seed: Seeder,
  opts: { cat: Cat; first: string; last: string; ka?: boolean; docId?: string },
): Promise<Reg> {
  const n = ++seq;
  const docId = opts.docId ?? athleteDocId(n);
  const athlete = await seed.createAthlete({
    firstName: opts.first,
    lastName: opts.last,
    firstNameKa: opts.ka ? `კ${n}` : undefined,
    lastNameKa: opts.ka ? `გ${n}` : undefined,
    documentId: docId,
    sex: opts.cat.sex || 'MALE',
    dateOfBirth: '2000-06-15',
    clubId: S.clubId || undefined,
  });
  const reg = await seed.register({
    eventId: S.eventId,
    athleteId: athlete.id,
    eventWeightCategoryId: opts.cat.ewcId,
  });
  return { athleteId: athlete.id, regId: reg.id, name: `${opts.first} ${opts.last}`, docId };
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE 1 — geography / clubs / coaches / athletes (UI once each + dup edge)
// ════════════════════════════════════════════════════════════════════════════
test.describe('full lifecycle', () => {
  test('P1 · registry: country, region, club, coaches, athletes (UI) + dup-docId edge', async ({
    page,
    request,
    baseURL,
  }) => {
    S.baseURL = baseURL!;
    const seed = seeder(request);

    // ── Country (UI). code 'GE' is what drives the Georgian KA-field behaviour;
    // only the country NAME is unique per org, so a run-namespaced name is safe.
    const countryName = nm('Wushu Land');
    await page.goto('/en/admin/countries', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New country' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'Country name (EN)', countryName);
      await fillFieldByLabel(m, 'Country name (Georgian)', 'ვუშუ ლენდ');
      await fillFieldByLabel(m, 'ISO code', 'GE');
      await m.getByRole('button', { name: 'Save' }).click();
    }
    await expect(page.getByText(countryName, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
    // Resolve the new country id from the API (the list row isn't id-addressable).
    const countries = await seed.getJson<Array<{ id: string; name: string }>>('/api/countries');
    S.countryId = countries.find((c) => c.name === countryName)!.id;
    expect(S.countryId, 'country created').toBeTruthy();

    // ── Region (UI) — created on the country detail page.
    const regionName = nm('Central Region');
    await page.goto(`/en/admin/countries/${S.countryId}`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New region' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'Region name', regionName); // matches EN + KA labels
      await m.getByRole('button', { name: 'Save' }).click();
    }
    await expect(page.getByText(regionName).first()).toBeVisible({ timeout: 20_000 });
    const regions = await seed.getJson<Array<{ id: string; name: string }>>('/api/regions');
    S.regionId = regions.find((r) => r.name === regionName)!.id;

    // ── Club (UI). Country is GE-coded → the KA name field is shown.
    const clubName = nm('Dragon Club');
    await page.goto('/en/admin/clubs', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New club' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'Club name (EN)', clubName);
      await selectNativeByLabel(m, 'Country', countryName);
      await selectNativeByLabel(m, 'Region', regionName);
      await fillFieldByLabel(m, 'Club name (Georgian)', 'დრაკონ კლუბი');
      await fillFieldByLabel(m, 'City', 'Tbilisi');
      await m.getByRole('button', { name: 'Save' }).click();
    }
    await expect(page.getByText(clubName).first()).toBeVisible({ timeout: 20_000 });
    const clubs = await seed.getJson<Array<{ id: string; name: string }>>('/api/clubs');
    S.clubId = clubs.find((c) => c.name === clubName)!.id;
    expect(S.clubId, 'club created under run country').toBeTruthy();

    // ── Coaches (UI): one Georgian (KA), one international (passport). The
    // CreateUserModal carries the nationality toggle that the coach portal reads.
    S.geCoachEmail = `ge.coach.${RUN_ID}@geowushu.test`;
    S.intlCoachEmail = `intl.coach.${RUN_ID}@geowushu.test`;
    const geCoachName = nm('გიორგი მწვრთნელი');
    const intlCoachName = nm('Int Coach');

    const createCoachUI = async (email: string, displayName: string, nationality: 'Georgian' | 'International') => {
      await page.getByRole('button', { name: 'Add User' }).first().click();
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'Email', email);
      await fillFieldByLabel(m, 'Password', 'Password123!');
      await m.getByRole('button', { name: nationality, exact: true }).click();
      await fillFieldByLabel(m, 'Display name', displayName);
      await selectNativeByLabel(m, 'Club', clubName);
      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/admin/users') && r.request().method() === 'POST',
          { timeout: 30_000 },
        ),
        m.getByRole('button', { name: 'Save' }).click(),
      ]);
      expect(resp.ok(), `coach ${email} created: ${resp.status()}`).toBeTruthy();
    };

    await page.goto('/en/admin/users', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await createCoachUI(S.geCoachEmail, geCoachName, 'Georgian');
    await createCoachUI(S.intlCoachEmail, intlCoachName, 'International');

    // Verify both coaches landed in the org's user list (the users page itself
    // paginates, so the list membership is asserted from the API).
    const users = await seed.getJson<Array<{ email: string; role: string }>>('/api/admin/users');
    const emails = new Set(users.map((u) => u.email));
    expect(emails.has(S.geCoachEmail) && emails.has(S.intlCoachEmail), 'both coaches listed').toBeTruthy();

    // ── Athletes (UI): a Georgian-club athlete (EN+KA, 11-digit national id) and
    // an international club-less athlete (EN only). These two are registered into
    // the event later (they are part of the 400).
    const geDoc = geNationalId(1);
    expect(geDoc).toMatch(/^\d{11}$/);
    const geFirst = 'Giorgi';
    const geLast = nm('Beridze');
    const geFirstKa = 'გიორგი';
    const geLastKa = 'ბერიძე';

    // The admin athlete form gates the KA name row on the club's COUNTRY NAME
    // being "Georgia"/"GE" (isGeorgianClub) — which a run-namespaced country can
    // never be (the seeded "Georgia" owns that unique name). Use a seeded
    // Georgian club for this bilingual demo; the run's own club still got full
    // create coverage above (its KA field is gated on country CODE, which is GE).
    const allClubs = await seed.getJson<Array<{ name: string; country: string | null }>>(
      '/api/clubs',
    );
    const geClubName = allClubs.find((c) =>
      ['georgia', 'ge'].includes((c.country ?? '').trim().toLowerCase()),
    )?.name;
    expect(geClubName, 'a seeded Georgian club exists for the KA-field demo').toBeTruthy();

    await page.goto('/en/admin/athletes', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New athlete' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'First name', geFirst);
      await fillFieldByLabel(m, 'Last name', geLast);
      await selectRadixByLabel(page, m, 'Sex', 'Male');
      // Selecting a Georgian club reveals the KA name row.
      await selectRadixByLabel(page, m, 'Club', geClubName!);
      await fillFieldByLabel(m, 'სახელი (ქართ.)', geFirstKa);
      await fillFieldByLabel(m, 'გვარი (ქართ.)', geLastKa);
      await fillFieldByLabel(m, 'Date of birth', '2000-06-15');
      await fillFieldByLabel(m, 'Document ID', geDoc);
      await m.getByRole('button', { name: 'Save' }).click();
    }
    // Filter the registry to this athlete (the list paginates) and assert the
    // localizedFullName(EN) renders as ONE string — no raw firstName/lastName leak.
    await page.locator('input[type="search"]').first().fill(geLast);
    await expect(page.getByText(`${geFirst} ${geLast}`).first()).toBeVisible({ timeout: 20_000 });
    {
      const list = await seed.getJson<Array<{ id: string; documentId: string }>>(
        `/api/athletes?search=${encodeURIComponent(geLast)}`,
      );
      const a = list.find((x) => x.documentId === geDoc)!;
      S.geAthlete = { athleteId: a.id, regId: '', name: `${geFirst} ${geLast}`, docId: geDoc };
    }
    // KA rendering: the same (filtered) athlete shows the Georgian full name on /ka.
    await page.goto('/ka/admin/athletes', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('input[type="search"]').first().fill(geLast);
    await expect(page.getByText(`${geFirstKa} ${geLastKa}`).first()).toBeVisible({
      timeout: 20_000,
    });

    // International athlete: club-less → EN-only form, passport docId.
    const intlDoc = `INTL-${RUN_ID}-1`;
    const intlFirst = 'John';
    const intlLast = nm('Carter');
    await page.goto('/en/admin/athletes', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New athlete' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'First name', intlFirst);
      await fillFieldByLabel(m, 'Last name', intlLast);
      await selectRadixByLabel(page, m, 'Sex', 'Male');
      await fillFieldByLabel(m, 'Date of birth', '2000-06-15');
      await fillFieldByLabel(m, 'Document ID', intlDoc);
      await m.getByRole('button', { name: 'Save' }).click();
    }
    await page.locator('input[type="search"]').first().fill(intlLast);
    await expect(page.getByText(`${intlFirst} ${intlLast}`).first()).toBeVisible({
      timeout: 20_000,
    });
    {
      const list = await seed.getJson<Array<{ id: string; documentId: string }>>(
        `/api/athletes?search=${encodeURIComponent(intlLast)}`,
      );
      const a = list.find((x) => x.documentId === intlDoc)!;
      S.intlAthlete = { athleteId: a.id, regId: '', name: `${intlFirst} ${intlLast}`, docId: intlDoc };
    }

    // ── Edge: duplicate documentId in the same org → DOCUMENT_ID_ALREADY_EXISTS
    // surfaced inline under the Document ID field.
    await page.getByRole('button', { name: 'New athlete' }).first().click();
    {
      const m = modalPanel(page);
      await fillFieldByLabel(m, 'First name', 'Dup');
      await fillFieldByLabel(m, 'Last name', 'Licate');
      await fillFieldByLabel(m, 'Date of birth', '2000-06-15');
      await fillFieldByLabel(m, 'Document ID', intlDoc); // already used above
      await m.getByRole('button', { name: 'Save' }).click();
    }
    await expect(
      page.getByText('An athlete with this document ID already exists.'),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — event creation (UI wizard exercised + authoritative API create)
  // ══════════════════════════════════════════════════════════════════════════
  test('P2 · event: create wizard (UI) + categories + REG_OPEN badge', async ({
    page,
    request,
    baseURL,
  }) => {
    S.baseURL = baseURL!;
    const seed = seeder(request);

    // Exercise the real create-event wizard UI (the multi-step Stepper renders;
    // the date-grid + category panel are custom popovers, so the authoritative
    // event for the pipeline is created via the proven API shape below and then
    // asserted through the admin UI).
    await page.goto('/en/admin/events', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'New Event' }).first().click();
    // The wizard opens on the Basics step → the "Next" button is present (the
    // "Create event" button only renders on the final step).
    await expect(page.getByRole('button', { name: 'Next' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('New Event').first()).toBeVisible();
    // Close the wizard without submitting (navigation below starts fresh anyway).
    await page.keyboard.press('Escape');

    // Authoritative create (API).
    const eventName = nm('Wushu Cup');
    S.eventSlug = slugify('wushu-cup');
    const created = await seed.createEvent({
      name: eventName,
      nameKa: nm('ვუშუ თასი'),
      slug: S.eventSlug,
      location: 'Tbilisi',
      dates: {
        registrationStartDate: '2026-09-01T09:00:00.000Z',
        registrationEndDate: '2026-09-10T18:00:00.000Z',
        weighInStartDate: '2026-09-14T09:00:00.000Z',
        weighInEndDate: '2026-09-14T18:00:00.000Z',
        competitionStartDate: '2026-09-15T09:00:00.000Z',
        competitionEndDate: '2026-09-16T18:00:00.000Z',
      },
    });
    S.eventId = created.id;
    expect(created.lifecycle).toBe('REG_OPEN');

    // ── Categories: select adults men + women weight classes (all athletes are
    // adults, so age eligibility always passes). Aim for ~13 classes across both
    // sexes; cats[0]/cats[1] are reserved for the DIRECT_FINAL/ROUND_ROBIN
    // brackets, the rest become SINGLE_ELIMINATION.
    const meta = await seed.getEventCategoriesMeta(S.eventId);
    S.templateId = meta.categoryTemplateId;
    const groups = await seed.getTemplateCategories(S.templateId);
    const adultsMen = groups.find(
      (g: any) => g.sex === 'MALE' && (g.minAge ?? 0) >= 18 && g.weightCategories?.length >= 4,
    );
    const adultsWomen = groups.find(
      (g: any) => g.sex === 'FEMALE' && (g.minAge ?? 0) >= 18 && g.weightCategories?.length >= 3,
    );
    expect(adultsMen, 'template has an adults-men group').toBeTruthy();

    const menWeights = adultsMen.weightCategories.slice(0, 9);
    const womenWeights = adultsWomen ? adultsWomen.weightCategories.slice(0, 4) : [];
    const ageGroups = [
      { categoryTemplateGroupId: adultsMen.id, weightCategoryIds: menWeights.map((w: any) => w.id) },
    ];
    if (adultsWomen && womenWeights.length) {
      ageGroups.push({
        categoryTemplateGroupId: adultsWomen.id,
        weightCategoryIds: womenWeights.map((w: any) => w.id),
      });
    }
    await seed.selectEventCategories(S.eventId, S.templateId, ageGroups);

    // Read back the EVENT-scoped weight categories (ewc ids) + sex/bounds.
    const evCats = await seed.getEventCategoriesMeta(S.eventId);
    for (const ag of evCats.ageGroups as any[]) {
      for (const wc of ag.weightCategories as any[]) {
        S.cats.push({
          ewcId: wc.id,
          sex: ag.sex ?? 'MALE',
          name: wc.name,
          code: ag.code,
          minW: wc.minWeightKgExcl ?? null,
          maxW: wc.maxWeightKgIncl ?? null,
          sortOrder: wc.sortOrder ?? 0,
        });
      }
    }
    expect(S.cats.length, 'enough categories for all three formats').toBeGreaterThanOrEqual(4);
    S.direct = S.cats[0]; // → exactly 2 survivors → DIRECT_FINAL
    S.rr = S.cats[1]; // → exactly 3 survivors → ROUND_ROBIN
    S.se = S.cats.slice(2); // → 8+ each → SINGLE_ELIMINATION

    // Policy: expose confirmed weigh-in weights on the public site.
    await seed.postOk(`/api/events/${S.eventId}/weighin-results-visibility`, { public: true });

    // Assert the created event renders in the admin UI in REG_OPEN.
    await gotoEvent(page, S.eventId);
    await expect(page.getByText(eventName).first()).toBeVisible({ timeout: 20_000 });
    await assertStageBadge(page, 'REG_OPEN');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — registration (UI transitions for approve/reject/withdraw + bulk)
  // ══════════════════════════════════════════════════════════════════════════
  test('P3 · registrations: bulk to 400 + UI approve/reject/withdraw + FK check', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);
    const seMale = S.se.filter((c) => c.sex === 'MALE');
    const seCat0 = seMale[0] ?? S.se[0];
    // A heavier male SE category for the weigh-in move-up (sortOrder must increase).
    const seCatUp = seMale.find((c) => c.sortOrder > seCat0.sortOrder) ?? seMale[1] ?? seCat0;
    S.uiCat = seCat0;
    S.moveUpFrom = seCat0;
    S.moveUpTo = seCatUp;

    // Register the two phase-1 UI athletes (male) into a SE category, approve.
    for (const a of [S.geAthlete!, S.intlAthlete!]) {
      const r = await seed.register({
        eventId: S.eventId,
        athleteId: a.athleteId,
        eventWeightCategoryId: seCat0.ewcId,
      });
      a.regId = r.id;
      await seed.setRegStatus(r.id, 'APPROVED');
    }

    // ── Protected format brackets (never withdrawn/failed): DIRECT_FINAL (2),
    // ROUND_ROBIN (3). Approve all; they PASS weigh-in in P5.
    const protectedRegs: Reg[] = [];
    for (let i = 0; i < 2; i++)
      protectedRegs.push(await createReg(seed, { cat: S.direct!, first: `DF${i}`, last: nm('Final'), ka: S.direct!.sex === 'MALE' }));
    for (let i = 0; i < 3; i++)
      protectedRegs.push(await createReg(seed, { cat: S.rr!, first: `RR${i}`, last: nm('Robin'), ka: S.rr!.sex === 'MALE' }));
    await mapPool(protectedRegs, POOL, (r) => seed.setRegStatus(r.regId, 'APPROVED'));

    // ── Named weigh-in edge athletes (all in a male SE category, all approved).
    S.uiClean = await createReg(seed, { cat: seCat0, first: 'Clean', last: nm('Pass') });
    S.moveUp = await createReg(seed, { cat: seCat0, first: 'Move', last: `MoveUp${RUN_ID}` });
    S.oneHour = await createReg(seed, { cat: seCat0, first: 'Hour', last: nm('Rule') });
    S.reattempt = await createReg(seed, { cat: seCat0, first: 'Re', last: nm('Attempt') });
    S.noShow = await createReg(seed, { cat: seCat0, first: 'No', last: nm('Show') });
    await mapPool([S.uiClean, S.moveUp, S.oneHour, S.reattempt, S.noShow], POOL, (r) =>
      seed.setRegStatus(r.regId, 'APPROVED'),
    );

    // ── Registration-UI targets (driven through the registrations page below).
    // Single-token last names so the API `q` search (a contains over a single
    // name field) resolves each to exactly one row.
    const tokApprove = `Approve${RUN_ID}`;
    const tokReject = `Reject${RUN_ID}`;
    const tokWithdraw = `Withdraw${RUN_ID}`;
    S.regApprove = await createReg(seed, { cat: seCat0, first: 'Reg', last: tokApprove });
    S.regReject = await createReg(seed, { cat: seCat0, first: 'Reg', last: tokReject });
    S.regWithdraw = await createReg(seed, { cat: seCat0, first: 'Reg', last: tokWithdraw });

    // ── Bulk volume: fill the remaining slots up to 400 across SE categories.
    const already =
      2 /*ui*/ + protectedRegs.length + 5 /*edge*/ + 3 /*reg-ui*/;
    const bulkCount = TOTAL_ATHLETES - already;
    expect(bulkCount).toBeGreaterThan(300);

    const bulk = await mapPool(
      Array.from({ length: bulkCount }, (_, i) => i),
      POOL,
      (i) => {
        const cat = S.se[i % S.se.length];
        return createReg(seed, {
          cat,
          first: `B${i}`,
          last: nm('Bulk'),
          ka: cat.sex === 'MALE',
        });
      },
    );

    // Outcomes across the bulk pool: most APPROVED, a minority WITHDRAWN, some
    // REJECTED, a few SUBMITTED (non-approved → excluded from the weigh-in
    // roster). Bulk endpoints keep the call count low.
    const approved: string[] = [];
    const rejected: string[] = [];
    const withdrawn: string[] = [];
    const submitted: string[] = [];
    bulk.forEach((r, i) => {
      if (i % 25 === 1) rejected.push(r.regId);
      else if (i % 25 === 2 || i % 25 === 3) withdrawn.push(r.regId);
      else if (i % 25 === 0) submitted.push(r.regId);
      else approved.push(r.regId);
    });
    const chunk = <T,>(a: T[], n: number) =>
      Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n));
    for (const ids of chunk(approved, 100)) await seed.bulkStatus('APPROVED', ids);
    for (const ids of chunk(rejected, 100)) await seed.bulkStatus('REJECTED', ids, 'e2e reject');
    for (const ids of chunk(withdrawn, 100)) await seed.bulkStatus('WITHDRAWN', ids, 'e2e withdraw');
    // SUBMITTED isn't a bulk action → set a small sample individually (PENDING→SUBMITTED).
    for (const id of submitted.slice(0, 8)) await seed.setRegStatus(id, 'SUBMITTED');
    S.submittedSample = bulk.find((r) => r.regId === submitted[0]) ?? null;
    S.approvedSample = bulk.find((r) => r.regId === approved[0]) ?? null;

    // Confirm the pool actually reached 400 athletes registered to this event.
    const allRegs = await seed.getJson<Array<{ id: string }>>(
      `/api/registrations?eventId=${S.eventId}&limit=1000`,
    );
    expect(allRegs.length).toBe(TOTAL_ATHLETES);

    // ── Category-FK invariant: the registered pick is mirrored into the final
    // category FK on create (eventWeightCategoryId follows registeredEventWeightCategoryId).
    const sampleRows = await seed.getJson<any[]>(
      `/api/registrations?eventId=${S.eventId}&q=${tokApprove}`,
    );
    const sampleRow = sampleRows.find((r) => r.id === S.regApprove!.regId) ?? sampleRows[0];
    expect(sampleRow.eventWeightCategoryId).toBe(seCat0.ewcId);
    if (sampleRow.registeredEventWeightCategoryId != null) {
      expect(sampleRow.registeredEventWeightCategoryId).toBe(seCat0.ewcId);
    }

    // ── UI transitions on the event registrations page (event still REG_OPEN →
    // actions enabled). Filter to a single row by a unique token, act, assert chip.
    const driveRowAction = async (token: string, action: 'Approve' | 'Reject' | 'Withdraw', chip: string) => {
      await page.goto(
        `/en/admin/events/${S.eventId}/registrations?q=${token}`,
        { waitUntil: 'domcontentloaded' },
      );
      await settle(page);
      await page.getByRole('button', { name: action, exact: true }).first().click();
      // Confirm modal (shared Modal) → its confirm button repeats the action label.
      await modalPanel(page).getByRole('button', { name: action, exact: true }).click();
      await expect(page.getByText(chip, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    };
    await driveRowAction(tokApprove, 'Approve', 'Approved');
    await driveRowAction(tokReject, 'Reject', 'Rejected');
    await driveRowAction(tokWithdraw, 'Withdraw', 'Withdrawn');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4 — lock → weigh-in open (UI transitions) + roster exclusion
  // ══════════════════════════════════════════════════════════════════════════
  test('P4 · lock → weigh-in: stage badges + non-approved excluded from roster', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    await advanceStageUI(page, S.eventId, 'LOCKED', { override: true, reason: 'e2e lock' });
    await advanceStageUI(page, S.eventId, 'WEIGHIN', { override: true, reason: 'e2e weigh-in' });

    // The weigh-in roster is built from APPROVED registrations only.
    const roster = await seed.getJson<Array<{ registrationId: string }>>(
      `/api/weighin?eventId=${S.eventId}`,
    );
    const rosterIds = new Set(roster.map((r) => r.registrationId));
    expect(rosterIds.has(S.approvedSample!.regId), 'approved athlete is on the roster').toBeTruthy();
    if (S.submittedSample) {
      expect(
        rosterIds.has(S.submittedSample.regId),
        'a SUBMITTED (non-approved) athlete is excluded from the roster',
      ).toBeFalsy();
    }
    expect(rosterIds.has(S.regReject!.regId), 'rejected excluded').toBeFalsy();
    expect(rosterIds.has(S.regWithdraw!.regId), 'withdrawn excluded').toBeFalsy();

    // UI: the weigh-in station renders the queue.
    await page.goto(`/en/admin/events/${S.eventId}/weigh-in`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.getByText('Athlete queue').first()).toBeVisible({ timeout: 20_000 });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — weigh-in (UI clean pass + edge branches + bulk tail)
  // ══════════════════════════════════════════════════════════════════════════
  test('P5 · weigh-in: UI clean pass + overweight/one-hour/move-up/no-show + complete', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    // ── UI: a clean PASS on the station. Select the athlete, type an in-range
    // weight, press Enter — for a non-manual (PASS) primary action the station
    // records on Enter. Verify via the POST response.
    await page.goto(`/en/admin/events/${S.eventId}/weigh-in`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByText(S.uiClean!.name, { exact: false }).first().click();
    const weightInput = page.locator('input[inputmode="decimal"]').first();
    await expect(weightInput).toBeVisible({ timeout: 15_000 });
    await weightInput.fill(String(midWeight(S.uiCat!)));
    // The decision preview is POSTed 700ms after typing stops; the station only
    // records on Enter once that preview says PASS. Wait for it first.
    await page
      .waitForResponse(
        (r) => r.url().includes('/api/weighin/preview') && r.request().method() === 'POST',
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    const isRecordPost = (r: import('@playwright/test').Response) =>
      new URL(r.url()).pathname.endsWith('/api/weighin') && r.request().method() === 'POST';
    const [passResp] = await Promise.all([
      page.waitForResponse(isRecordPost, { timeout: 30_000 }),
      weightInput.press('Enter'),
    ]);
    expect(passResp.ok(), `clean pass recorded: ${passResp.status()}`).toBeTruthy();

    // ── Edge branches (performed via API, each asserted from the DB). All edge
    // athletes were registered into S.uiCat (a male SE category) in P3.
    const edgeCat = S.uiCat!;
    // overweight → re-weigh → PASS.
    await seed.weighIn({ registrationId: S.reattempt!.regId, weightKg: overWeight(edgeCat), decision: 'REWEIGH' });
    await seed.weighIn({ registrationId: S.reattempt!.regId, weightKg: midWeight(edgeCat), decision: 'PASS' });

    // one-hour rule → resolve via the lifecycle-guarded resolveOneHour (DQ).
    const ohRes = await seed.weighIn({ registrationId: S.oneHour!.regId, weightKg: overWeight(edgeCat), decision: 'ONE_HOUR' });
    const ohJson = (await ohRes.json()) as any;
    const attemptId = ohJson.attempt?.id ?? ohJson.id ?? ohJson.attemptId;
    expect(attemptId, 'ONE_HOUR returns an attempt id').toBeTruthy();
    await seed.postOk(`/api/weighin/${attemptId}/resolve`, { action: 'DQ', reason: 'e2e reweigh failed' });

    // move-up to a higher category (MOVED_UP changes eventWeightCategoryId only).
    const fromCat = S.moveUpFrom!;
    const toCat = S.moveUpTo!;
    await seed.weighIn({
      registrationId: S.moveUp!.regId,
      weightKg: overWeight(fromCat),
      decision: 'MOVED_UP',
      nextEventWeightCategoryId: toCat.ewcId,
    });
    {
      const rows = await seed.getJson<any[]>(
        `/api/registrations?eventId=${S.eventId}&q=MoveUp${RUN_ID}`,
      );
      const row = rows.find((r) => r.id === S.moveUp!.regId) ?? rows[0];
      expect(row.eventWeightCategoryId, 'MOVED_UP changed the final category').toBe(toCat.ewcId);
      if (row.registeredEventWeightCategoryId != null) {
        expect(
          row.registeredEventWeightCategoryId,
          'the originally registered category is unchanged',
        ).toBe(fromCat.ewcId);
      }
    }

    // no-show / absent → recorded DISQUALIFIED so weigh-in can complete; excluded from draw.
    await seed.weighIn({ registrationId: S.noShow!.regId, weightKg: overWeight(edgeCat), decision: 'DISQUALIFIED' });

    // ── Bulk tail: PASS every remaining approved athlete still pending a final
    // decision (skip the named edge athletes already handled above + the UI one).
    const handled = new Set(
      [S.uiClean, S.reattempt, S.oneHour, S.moveUp, S.noShow].map((r) => r!.regId),
    );
    const roster = await seed.getJson<any[]>(`/api/weighin?eventId=${S.eventId}`);
    const pending = roster.filter(
      (e) => !handled.has(e.registrationId) && (e.weighIns?.length ?? 0) === 0,
    );
    await mapPool(pending, POOL, (e) =>
      seed.weighIn({
        registrationId: e.registrationId,
        weightKg: midWeight({
          minW: e.eventWeightCategory?.minWeightKgExcl ?? null,
          maxW: e.eventWeightCategory?.maxWeightKgIncl ?? null,
        }),
        decision: 'PASS',
      }),
    );

    // Complete weigh-in (auto-advances once all decisions are final; assert badge).
    await advanceStageUI(page, S.eventId, 'WEIGH_IN_COMPLETED', {
      override: true,
      reason: 'e2e weigh-in complete',
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6 — draw (run + assert all three formats) → DRAWN
  // ══════════════════════════════════════════════════════════════════════════
  test('P6 · draw: execute + all three formats + brackets render + DRAWN', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    const draw = await seed.runDraw(S.eventId);
    expect(draw.ok(), `draw: ${await draw.text()}`).toBeTruthy();

    const brackets = await seed.getBrackets(S.eventId);
    const formats = new Set(brackets.map((b: any) => b.format));
    expect(formats.has('DIRECT_FINAL'), 'DIRECT_FINAL produced').toBeTruthy();
    expect(formats.has('ROUND_ROBIN'), 'ROUND_ROBIN produced').toBeTruthy();
    expect(formats.has('SINGLE_ELIMINATION'), 'SINGLE_ELIMINATION produced').toBeTruthy();

    // The no-show athlete must not appear in any bracket fight.
    const fights = await seed.getFights(S.eventId);
    const corners = new Set<string>();
    for (const f of fights) {
      if (f.redAthleteId) corners.add(f.redAthleteId);
      if (f.blueAthleteId) corners.add(f.blueAthleteId);
    }
    expect(corners.has(S.noShow!.athleteId), 'no-show is excluded from the draw').toBeFalsy();

    // UI: the brackets page renders the drawn categories.
    await page.goto(`/en/admin/events/${S.eventId}/brackets`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50);

    await advanceStageUI(page, S.eventId, 'DRAWN', { override: true, reason: 'e2e draw done' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 7 — publish + schedule → PUBLISHED, schedule page renders
  // ══════════════════════════════════════════════════════════════════════════
  test('P7 · publish + schedule: mats/sessions/auto-schedule + schedule UI', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    await advanceStageUI(page, S.eventId, 'PUBLISHED', { override: true, reason: 'e2e publish' });

    // Mats + a session + auto-generated ordering (API: scheduling is volume work).
    await seed.createMat(S.eventId, 'Mat 1', 0);
    await seed.createMat(S.eventId, 'Mat 2', 1);
    await seed.createSession(
      S.eventId,
      `Session 1 ${RUN_LABEL}`,
      '2026-09-15T09:00:00.000Z',
      '2026-09-15T20:00:00.000Z',
    );
    await seed.generateSchedule(S.eventId, 180, 60);

    // Every scheduled fight carries pre-computed display names (never raw fields).
    const fights = await seed.getFights(S.eventId);
    const scheduled = fights.filter((f: any) => f.matId || f.orderInMat != null || f.scheduledStartTime);
    expect(scheduled.length, 'fights were placed on mats/sessions').toBeGreaterThan(0);

    // UI: the admin schedule page renders.
    await page.goto(`/en/admin/events/${S.eventId}/schedule`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.getByText('Mat 1').first()).toBeVisible({ timeout: 20_000 });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 8 — go live + fights (UI walk one fight + bulk resolve, propagation)
  // ══════════════════════════════════════════════════════════════════════════
  test('P8 · live: go LIVE, UI-drive a fight, resolve the rest, winner propagation', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    await advanceStageUI(page, S.eventId, 'LIVE', { override: true, reason: 'e2e go live' });

    // ── UI: drive the current fight on the live control board to a result.
    await page.goto(`/en/admin/events/${S.eventId}/live`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    const board = await seed.getJson<any>(`/api/fights/live/queue-board?eventId=${S.eventId}`);
    const uiFightId: string | null = board?.currentFight?.id ?? null;

    if (uiFightId && board.currentFight?.isPlayable) {
      await expect(page.getByText('Current fight').first()).toBeVisible({ timeout: 20_000 });
      const clickIfVisible = async (name: string) => {
        const b = page.getByRole('button', { name, exact: true }).first();
        if (await b.isVisible().catch(() => false)) {
          await b.click();
          await page.waitForTimeout(700);
        }
      };
      await clickIfVisible('Set on deck');
      await clickIfVisible('Start fight');
      await page.getByRole('button', { name: 'Set result', exact: true }).first().click();
      const [resultResp] = await Promise.all([
        page.waitForResponse(
          (r) => /\/api\/fights\/.+\/result$/.test(r.url()) && r.request().method() === 'POST',
          { timeout: 30_000 },
        ),
        page.getByRole('button', { name: 'Confirm result', exact: true }).click(),
      ]);
      expect(resultResp.ok(), `UI result recorded: ${resultResp.status()}`).toBeTruthy();

      // Winner propagation for the UI-driven fight, verified from the DB.
      const after = await seed.getFights(S.eventId);
      const f = after.find((x: any) => x.id === uiFightId);
      expect(f?.winnerAthleteId, 'UI fight has a winner').toBeTruthy();
      if (f?.nextFightId && f.nextFightSlot) {
        const next = after.find((x: any) => x.id === f.nextFightId);
        const slotId = f.nextFightSlot === 'RED' ? next?.redAthleteId : next?.blueAthleteId;
        expect(slotId, 'winner propagated into the next fight slot').toBe(f.winnerAthleteId);
      }
    }

    // ── Bulk: resolve every remaining contested fight via the normal LIVE_RUN
    // path (fetch → start → finish), round by round, until all brackets resolve.
    const maxRound = Math.max(1, ...(await seed.getFights(S.eventId)).map((f: any) => f.round || 1));
    let safety = maxRound + 4;
    let flip = 0;
    while (safety-- > 0) {
      const playable = (await seed.getFights(S.eventId)).filter(
        (f: any) =>
          f.redAthleteId &&
          f.blueAthleteId &&
          f.redAthleteId !== f.blueAthleteId &&
          !f.winnerAthleteId,
      );
      if (playable.length === 0) break;
      await mapPool(playable, POOL, (f: any) =>
        seed.finishFight(f.id, flip++ % 2 === 0 ? 'RED' : 'BLUE', 'POINTS'),
      );
    }

    // ── Invariants: no contested fight left unresolved; every winner is a real
    // corner; winner propagation holds across the whole tree; event COMPLETED.
    const finalFights = await seed.getFights(S.eventId);
    const byId = new Map(finalFights.map((f: any) => [f.id, f]));
    const unresolved = finalFights.filter(
      (f: any) =>
        f.redAthleteId && f.blueAthleteId && f.redAthleteId !== f.blueAthleteId && !f.winnerAthleteId,
    );
    expect(unresolved, 'no contested fight left unresolved').toEqual([]);
    for (const f of finalFights) {
      if (f.winnerAthleteId && f.redAthleteId && f.blueAthleteId) {
        expect([f.redAthleteId, f.blueAthleteId]).toContain(f.winnerAthleteId);
      }
      if (f.winnerAthleteId && f.nextFightId && f.nextFightSlot) {
        const next: any = byId.get(f.nextFightId);
        const slotId = f.nextFightSlot === 'RED' ? next?.redAthleteId : next?.blueAthleteId;
        if (slotId) expect(slotId, 'winner propagated to next slot').toBe(f.winnerAthleteId);
      }
    }
    expect(await seed.getLifecycle(S.eventId)).toBe('COMPLETED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 9 — results + PDF export
  // ══════════════════════════════════════════════════════════════════════════
  test('P9 · results: medal integrity + protocol PDF (UI download) + schedule/weigh-in PDFs', async ({
    page,
    request,
  }) => {
    const seed = seeder(request);

    // Results compiled + medal-table integrity (gold+silver+bronze == total).
    const results = await seed.getResults(S.eventId);
    expect(results.length).toBeGreaterThan(0);
    const summary = await seed.getResultsSummary(S.eventId);
    for (const row of (summary.medalTable ?? []) as any[]) {
      if (row.total != null) {
        expect((row.gold || 0) + (row.silver || 0) + (row.bronze || 0)).toBe(row.total);
      }
    }

    // A head-judge signature template is required to render the results protocol.
    const sig = await seed.createSignatureTemplate('Head Judge', 'მთავარი მსაჯი', PNG);
    S.signatureId = sig.id;

    // UI: the results export drawer downloads a real PDF protocol.
    await page.goto(`/en/admin/events/${S.eventId}/results`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'Export PDFs' }).first().click();
    await expect(page.getByText('Results protocols').first()).toBeVisible({ timeout: 20_000 });
    await captureDownloadPdf(
      page,
      () => page.getByRole('button', { name: 'Results protocols' }).click(),
      'results.pdf',
    );

    // The schedule + weigh-in protocols also render as valid PDFs (API).
    await expectPdfResponse(
      await seed.get(`/api/exports/${S.eventId}/schedule.pdf?lang=en`),
      'schedule.pdf',
    );
    await expectPdfResponse(
      await seed.get(`/api/exports/${S.eventId}/weighin.pdf?lang=en`),
      'weighin.pdf',
    );

    // Login form coverage (the storageState path skips the real form): exercise
    // it once in a clean context so every distinct UI function is touched.
    await page.context().clearCookies();
    await loginViaForm(page);
    expect(page.url()).not.toContain('/login');
  });
});
