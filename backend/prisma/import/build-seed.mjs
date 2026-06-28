// Transforms the deduped workbook export
// (wushu_sanda_GLOBAL_DEDUPED_import_v2_FINAL.json) into a clean, schema-shaped
// seed file (wushu-seed.json) that prisma/import/seed-import.ts consumes.
//
// What it does:
//  - resolves a bilingual (en + ka) name for every athlete/club, using the real
//    cross-event source names where available and transliterating only the
//    missing side;
//  - recovers the 6 missing DOBs from per-event source rows;
//  - synthesizes a stable, unique documentId per athlete (no national IDs exist
//    in the source — mirrors the historical LEGACY_ backfill);
//  - derives country + (one-per-country) region from source area names;
//  - builds one shared category template (age groups + weights) from the union
//    of all divisions, with proper bounds + round durations;
//  - emits per-event registrations, weigh-ins and confirmed fights wired to the
//    canonical categories.
//
// Run: node backend/prisma/import/build-seed.mjs
//
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  isGeorgian,
  kaToLatin,
  latinToKa,
  splitName,
} from './transliterate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, 'source-export.json');
const OUT = resolve(HERE, 'wushu-seed.json');

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const warnings = [];
const warn = (m) => warnings.push(m);

// Athlete / coach / club de-duplication runs after the curated maps are
// defined (national-ID + loose-name merge) — see "De-duplication" below.

// Real document IDs OCR'd from passport/ID scans (gid -> {id}); SKIP = unreadable.
let realIds = new Map();
try {
  const ex = JSON.parse(readFileSync(resolve(HERE, 'id-extracted.json'), 'utf8'));
  realIds = new Map(
    Object.entries(ex).filter(([, v]) => v.id && v.id !== 'SKIP').map(([gid, v]) => [gid, v.id]),
  );
} catch { /* no OCR file yet — all placeholders */ }

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------
const COUNTRY_META = {
  GE: { name: 'Georgia', nameKa: 'საქართველო' },
  AM: { name: 'Armenia', nameKa: 'სომხეთი' },
  IN: { name: 'India', nameKa: 'ინდოეთი' },
  KZ: { name: 'Kazakhstan', nameKa: 'ყაზახეთი' },
  IR: { name: 'Iran', nameKa: 'ირანი' },
  TR: { name: 'Turkiye', nameKa: 'თურქეთი' },
  TM: { name: 'Turkmenistan', nameKa: 'თურქმენეთი' },
  UZ: { name: 'Uzbekistan', nameKa: 'უზბეკეთი' },
  IEWA: { name: 'IEWA', nameKa: 'IEWA' },
};
// Curated club fixups. The source deduped athletes well but left club rows
// messy: a junk "None" club, two duplicate pairs, and transliteration-only
// names where a real bilingual pair is known. Keyed by globalClubId.
const CLUB_DROP = new Set(['club_item_da39a3ee']); // "None" -> athletes get null club
const CLUB_MERGE = {
  club_tbilisis_pederatsia_8807db3f: 'club_tbilisi_21124c8c', // თბილისის უშუ ფედერაცია
  'club_tbilisis-pederatsia_8807db3f': 'club_tbilisi_21124c8c',
  'club_tsalkis-sasporto-skolis_9d9c7a65': 'club_tsalka_274787bd', // genitive dup
};
const CLUB_OVERRIDES = {
  club_aktau_178184bf: { name: 'Aktau', nameKa: 'აქტაუ' },
  club_aktobe_66f66ce2: { name: 'Aktobe', nameKa: 'აქტობე' },
  'club_ambrolauri-avaza_5e83fca3': { name: 'Ambrolauri Club Avaza', nameKa: 'ამბროლაურის კლუბი ავაზა' },
  club_artsivi_7e4703bf: { name: 'Artsivi', nameKa: 'არწივი' },
  club_barlas_c99d399b: { name: 'Barlas', nameKa: 'ბარლასი' },
  club_bolnisi_f81528cb: { name: 'Bolnisi Club', nameKa: 'ბოლნისის კლუბი' },
  club_dedoflistskaro_6a25ad6d: { name: 'Dedoplistskaro Wushu Team', nameKa: 'დედოფლისწყაროს უშუს გუნდი' },
  club_india_e074138d: { name: 'India', nameKa: 'ინდოეთი' },
  club_kutaisi_31108088: { name: 'Kutaisi Wushu Federation Team', nameKa: 'ქუთაისის უშუს ფედერაციის გუნდი' },
  'club_kutaisi-aieti-2017_67fe0141': { name: 'Kutaisi Ushu Sanda Club Aieti-2017', nameKa: 'ქუთაისის უშუ სანდას კლუბი აიეტი-2017' },
  club_shymkent_2a444c09: { name: 'Shymkent', nameKa: 'შიმქენთი' },
  club_tbilisi_21124c8c: { name: 'Tbilisi Wushu Federation Team', nameKa: 'თბილისის უშუს ფედერაციის გუნდი' },
  'club_traditional-of-armenia_2847edda': { name: 'Traditional Wushu Federation of Armenia Team', nameKa: 'სომხეთის ტრადიციული უშუს ფედერაციის გუნდი' },
  club_uzbekistan_d69c4971: { name: 'Uzbekistan Wushu Federation Team', nameKa: 'უზბეკეთის უშუს ფედერაციის გუნდი' },
  club_bakhtrioni_b4c2b350: { name: 'Bakhtrioni Wushu Club', nameKa: 'ბახტრიონის უშუს კლუბი' },
  club_warriors_014f7c10: { name: 'Warriors', nameKa: 'ვორიორსი' },
  'club_tavisuplai-universitetis-mebrdzolta_c4ac4b09': { name: 'Free University Fighters Club', nameKa: 'თავისუფალი უნივერსიტეტის მებრძოლთა კლუბი' },
  club_tsalka_274787bd: { name: 'Tsalka Sports School', nameKa: 'წალკის სასპორტო სკოლა' },
  club_chqondidi_94e2f5f6: { name: 'Chkhondidi', nameKa: 'ჭყონდიდი' },
};
// Resolve a raw club id to its canonical (post-merge) id, or null if dropped.
const resolveClub = (id) => (id == null || CLUB_DROP.has(id) ? null : (CLUB_MERGE[id] ?? id));

// The only four source entries that are themselves federations (not clubs).
// Each becomes a real Federation row PLUS a same-named "… Team" club nested
// under it (the federation fields its own athletes). EVERY other club stays
// independent (federationKey = null) — the source sheets carry no club→
// federation hierarchy, so we don't invent one. Keyed by globalClubId → fed key.
const FEDERATION_TEAM_CLUBS = {
  club_tbilisi_21124c8c: 'fed:GE:Tbilisi',
  club_kutaisi_31108088: 'fed:GE:Kutaisi',
  club_uzbekistan_d69c4971: 'fed:UZ',
  'club_traditional-of-armenia_2847edda': 'fed:AM',
};
// The real federations (id, host city key, bilingual name). Only these exist —
// no synthetic "<City> Wushu Federation" per city.
const REAL_FEDERATIONS = [
  { key: 'fed:GE:Tbilisi', cityKey: 'GE:Tbilisi', name: 'Tbilisi Wushu Federation', nameKa: 'თბილისის უშუს ფედერაცია' },
  { key: 'fed:GE:Kutaisi', cityKey: 'GE:Kutaisi', name: 'Kutaisi Wushu Federation', nameKa: 'ქუთაისის უშუს ფედერაცია' },
  { key: 'fed:UZ', cityKey: 'UZ', name: 'Uzbekistan Wushu Federation', nameKa: 'უზბეკეთის უშუს ფედერაცია' },
  { key: 'fed:AM', cityKey: 'AM', name: 'Traditional Wushu Federation of Armenia', nameKa: 'სომხეთის ტრადიციული უშუს ფედერაცია' },
];

// Georgian municipalities (cities) — the Tbilisi sheet's "area" column carries
// these; map the Georgian-script value to a bilingual region.
const MUNICIPALITY = {
  'თბილისი': { en: 'Tbilisi', ka: 'თბილისი' },
  'ქუთაისი': { en: 'Kutaisi', ka: 'ქუთაისი' },
  'მარტვილი': { en: 'Martvili', ka: 'მარტვილი' },
  'მარნეული': { en: 'Marneuli', ka: 'მარნეული' },
  'წალკა': { en: 'Tsalka', ka: 'წალკა' },
  'დუშეთი': { en: 'Dusheti', ka: 'დუშეთი' },
  'დედოფლისწყარო': { en: 'Dedoplistskaro', ka: 'დედოფლისწყარო' },
  'თერჯოლა': { en: 'Terjola', ka: 'თერჯოლა' },
  'თიანეთი': { en: 'Tianeti', ka: 'თიანეთი' },
  'ზუგდიდი': { en: 'Zugdidi', ka: 'ზუგდიდი' },
  'რუსთავი': { en: 'Rustavi', ka: 'რუსთავი' },
  'ამბროლაური': { en: 'Ambrolauri', ka: 'ამბროლაური' },
  'ბოლნისი': { en: 'Bolnisi', ka: 'ბოლნისი' },
  'ლაგოდეხი': { en: 'Lagodekhi', ka: 'ლაგოდეხი' },
  'საგარეჯო': { en: 'Sagarejo', ka: 'საგარეჯო' },
  'იორმუღანლო': { en: 'Iormughanlo', ka: 'იორმუღანლო' },
  'ქარელი': { en: 'Kareli', ka: 'ქარელი' },
  'ყაზბეგი': { en: 'Kazbegi', ka: 'ყაზბეგი' },
  'ბათუმი': { en: 'Batumi', ka: 'ბათუმი' },
};
// Region for Georgian clubs that never appear in the Tbilisi sheet (so have no
// municipality from the area column). Keyed by globalClubId -> municipality EN.
const CLUB_REGION_OVERRIDE = {
  'club_ambrolauri-avaza_5e83fca3': 'Ambrolauri',
  club_bolnisi_f81528cb: 'Bolnisi',
  club_dedoflistskaro_6a25ad6d: 'Dedoplistskaro',
  club_bakhtrioni_b4c2b350: 'Tbilisi',
};
const muniByEn = new Map(Object.values(MUNICIPALITY).map((m) => [m.en, m]));

function areaToCountry(area) {
  if (!area) return null;
  const a = area.trim().toLowerCase();
  if (a === 'armenia') return 'AM';
  if (a === 'india') return 'IN';
  if (a === 'iran') return 'IR';
  if (a === 'kazakhstan') return 'KZ';
  if (a === 'turkiye' || a === 'turkey') return 'TR';
  if (a === 'turkmenistan') return 'TM';
  if (a === 'uzbekistan') return 'UZ';
  if (a === 'iewa') return 'IEWA';
  // "Georgia" or any Georgian municipality (Tbilisi sheet) -> GE
  return 'GE';
}

// ---------------------------------------------------------------------------
// Age groups (canonical, shared template)
// ---------------------------------------------------------------------------
const AGE_GROUPS = {
  '6_8': { name: 'Children 6-8', nameKa: 'ბავშვები 6-8', minAge: 6, maxAge: 8, round: 60, sort: 1 },
  '9_11': { name: 'Children 9-11', nameKa: 'ბავშვები 9-11', minAge: 9, maxAge: 11, round: 60, sort: 2 },
  '12_14': { name: 'Cadets 12-14', nameKa: 'კადეტები 12-14', minAge: 12, maxAge: 14, round: 90, sort: 3 },
  '15_17': { name: 'Juniors 15-17', nameKa: 'ახალგაზრდები 15-17', minAge: 15, maxAge: 17, round: 90, sort: 4 },
  '18_': { name: 'Adults 18+', nameKa: 'ზრდასრულები 18+', minAge: 18, maxAge: null, round: 120, sort: 5 },
};

// weightKey "_65" -> { maxKg: 65 }, "100_" -> { minKg: 100 }, name labels
function weightBounds(weightKey) {
  if (!weightKey) return null;
  if (weightKey.endsWith('_') && !weightKey.startsWith('_')) {
    const min = Number(weightKey.replace('_', ''));
    return { minKg: min, maxKg: null, name: `> ${min} kg`, nameKa: `> ${min} კგ` };
  }
  const max = Number(weightKey.replace(/_/g, ''));
  if (!Number.isFinite(max)) return null;
  return { minKg: null, maxKg: max, name: `≤ ${max} kg`, nameKa: `≤ ${max} კგ` };
}
const weightSort = (weightKey) => {
  const b = weightBounds(weightKey);
  return b ? (b.maxKg ?? b.minKg + 1000) : 9999;
};

const SEX_FROM_PREFIX = { ვ: 'MALE', გ: 'FEMALE', M: 'MALE', F: 'FEMALE' };

// ---------------------------------------------------------------------------
// De-duplication — collapse the SAME person/coach/club that the Drive extractor
// split into several rows. The extractor keys athletes by name|DOB|gender, so a
// competitor splinters whenever their birth date drifts between the 2024/25/26
// sheets (day↔month swaps, year ±1) OR their name is transliterated differently
// (e.g. the Georgian nominative "-i": "Nazarov" vs "Nazarovi"). We merge with
// three signals, strongest first:
//   1. same national ID (definitive — and the real ID is kept on the survivor),
//   2. shared coach or shared club,
//   3. compatible DOB.
// Coaches and clubs are collapsed by loose (transliteration-tolerant) name.
// Every reference (participants, registrations, weigh-ins, fights, votes) is
// rewired to the surviving canonical id.
{
  // National IDs OCR'd from ID scans (gid -> id). Loaded here too so a merge can
  // prefer the row that already carries a real ID and keep it on the survivor.
  let nationalId = new Map();
  try {
    const ex = JSON.parse(readFileSync(resolve(HERE, 'id-extracted.json'), 'utf8'));
    nationalId = new Map(
      Object.entries(ex).filter(([, v]) => v.id && v.id !== 'SKIP').map(([g, v]) => [g, v.id]),
    );
  } catch { /* no OCR file */ }

  const stripDia = (s) => (s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Transliteration-tolerant key: ascii tokens, drop a trailing Georgian
  // nominative "-i" on long tokens, sort so first/last order doesn't matter.
  const looseName = (s, stop = []) =>
    stripDia(s)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t && !stop.includes(t))
      .map((t) => (t.length >= 5 && t.endsWith('i') ? t.slice(0, -1) : t))
      .sort()
      .join(' ');

  const parseDob = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return { y, m, d, t: Date.UTC(y, m - 1, d) };
  };
  const dobCompatible = (s1, s2) => {
    if (!s1 || !s2) return true;
    if (s1 === s2) return true;
    const a = parseDob(s1), b = parseDob(s2);
    if (!a || !b) return true;
    if (a.y === b.y && a.m === b.d && a.d === b.m) return true;
    if (a.m === b.m && a.d === b.d && Math.abs(a.y - b.y) <= 1) return true;
    if (Math.abs(a.t - b.t) <= 14 * 86400000) return true;
    return false;
  };
  const overlap = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };

  // Per-athlete coach/club signals from every event's participants + regs.
  const coachesOf = new Map(); // gid -> Set(coachId)
  const clubsOf = new Map();   // gid -> Set(clubId)
  const addSig = (map, k, v) => { if (!k || !v) return; if (!map.has(k)) map.set(k, new Set()); map.get(k).add(v); };
  for (const ev of raw.events ?? []) {
    for (const p of ev.eventParticipants ?? []) {
      for (const c of p.globalCoachIds ?? []) addSig(coachesOf, p.globalAthleteId, c);
      addSig(clubsOf, p.globalAthleteId, p.globalClubId);
    }
    for (const r of ev.registrations ?? []) {
      for (const c of r.globalCoachIds ?? []) addSig(coachesOf, r.globalAthleteId, c);
      addSig(clubsOf, r.globalAthleteId, r.globalClubId);
    }
  }
  const aSignal = (g) => (coachesOf.get(g)?.size ?? 0) + (clubsOf.get(g)?.size ?? 0);

  // ---- ATHLETES -----------------------------------------------------------
  const aGroups = new Map();
  for (const a of raw.global.athletes) {
    const k = `${looseName(a.normalizedNameKey)}|${a.gender}`;
    if (!aGroups.has(k)) aGroups.set(k, []);
    aGroups.get(k).push(a);
  }
  const aRemap = new Map();
  for (const group of aGroups.values()) {
    if (group.length < 2) continue;
    const clusters = [];
    for (const a of group) {
      const ac = coachesOf.get(a.globalAthleteId) ?? new Set();
      const acl = clubsOf.get(a.globalAthleteId) ?? new Set();
      const aid = nationalId.get(a.globalAthleteId);
      const cl = clusters.find((c) => {
        if (aid && c.ids.size && !c.ids.has(aid)) return false; // different real ID = different person
        return (aid && c.ids.has(aid)) || overlap(ac, c.coaches) || overlap(acl, c.clubs) ||
          c.members.some((m) => dobCompatible(a.dateOfBirth, m.dateOfBirth));
      });
      const tgt = cl ?? (clusters.push({ members: [], coaches: new Set(), clubs: new Set(), ids: new Set() }), clusters[clusters.length - 1]);
      tgt.members.push(a);
      for (const x of ac) tgt.coaches.add(x);
      for (const x of acl) tgt.clubs.add(x);
      if (aid) tgt.ids.add(aid);
    }
    for (const cl of clusters) {
      if (cl.members.length < 2) continue;
      // Survivor: prefer a row that carries a real national ID, then most signal.
      const canon = cl.members.slice().sort((x, y) =>
        (nationalId.has(y.globalAthleteId) ? 1 : 0) - (nationalId.has(x.globalAthleteId) ? 1 : 0) ||
        aSignal(y.globalAthleteId) - aSignal(x.globalAthleteId) ||
        x.globalAthleteId.localeCompare(y.globalAthleteId))[0];
      const votes = new Map();
      for (const m of cl.members)
        for (const v of (m.dateOfBirthValues ?? [m.dateOfBirth])) if (v) votes.set(v, (votes.get(v) ?? 0) + 1);
      const bestDob = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
      if (bestDob) canon.dateOfBirth = bestDob;
      canon.dateOfBirthValues = [...new Set(cl.members.flatMap((m) => m.dateOfBirthValues ?? [m.dateOfBirth]).filter(Boolean))];
      for (const m of cl.members) {
        if (m.globalAthleteId === canon.globalAthleteId) continue;
        aRemap.set(m.globalAthleteId, canon.globalAthleteId);
        warn(`merged athlete ${m.canonicalName} (${m.globalAthleteId}) -> ${canon.canonicalName} (${canon.globalAthleteId})`);
      }
    }
  }
  if (aRemap.size) {
    const R = (id) => (id == null ? id : (aRemap.get(id) ?? id));
    raw.global.athletes = raw.global.athletes.filter((a) => !aRemap.has(a.globalAthleteId));
    for (const ev of raw.events ?? []) {
      for (const p of ev.eventParticipants ?? []) p.globalAthleteId = R(p.globalAthleteId);
      for (const r of ev.registrations ?? []) r.globalAthleteId = R(r.globalAthleteId);
      for (const w of ev.weighIns ?? []) w.globalAthleteId = R(w.globalAthleteId);
      for (const f of ev.fights ?? []) {
        if (f.red) f.red.globalAthleteId = R(f.red.globalAthleteId);
        if (f.blue) f.blue.globalAthleteId = R(f.blue.globalAthleteId);
        if (f.result) f.result.winnerGlobalAthleteId = R(f.result.winnerGlobalAthleteId);
      }
    }
    warn(`athlete dedup: ${aRemap.size} duplicate row(s) merged; ${raw.global.athletes.length} athletes remain`);
  }

  // ---- CLUBS --------------------------------------------------------------
  // Club names are the noisiest field (free-text per sheet, heavy OCR drift:
  // "Dedoplistkaro"/"Dedoplisitsqaro"/"Dedopltsiraqo", "Barlas"/"Barals"/
  // "Balas", six "Tbilisi … Federation" spellings). Exact-name matching can't
  // catch these, so we use the reliable signal: a club is identified by its
  // COACHES. Union clubs that share a coach (within the same country), plus any
  // that share an identical stripped-name root. Then collapse each component.
  const CLUB_STOP = ['club', 'klub', 'klubi', 'wushu', 'ushu', 'ushus', 'sanda', 'sandas', 'team', 'sport', 'sportuli', 'sportklubi', 'sporto', 'sasporto', 'saporto', 'skola', 'kompleksuri', 'pederatsia', 'federatsia', 'federation', 'gundi', 'jgupi', 'pd', 'fight', 'fght'];

  const clubCoaches = new Map(); // clubId -> Set(coachId)
  const addCoach = (cid, co) => { if (!cid || !co || CLUB_DROP.has(cid)) return; if (!clubCoaches.has(cid)) clubCoaches.set(cid, new Set()); clubCoaches.get(cid).add(co); };
  for (const ev of raw.events ?? []) {
    for (const p of ev.eventParticipants ?? []) for (const co of p.globalCoachIds ?? []) addCoach(p.globalClubId, co);
    for (const r of ev.registrations ?? []) for (const co of r.globalCoachIds ?? []) addCoach(r.globalClubId, co);
  }
  const countryOfClub = (c) => topVote(clubCountryVotesRaw.get(c.globalClubId)) ?? 'GE';
  // (light country vote straight from participants, before pass-1 runs)
  const clubCountryVotesRaw = new Map();
  for (const ev of raw.events ?? []) for (const p of ev.eventParticipants ?? []) {
    if (!p.globalClubId || CLUB_DROP.has(p.globalClubId)) continue;
    const ctry = areaToCountry(p.sourceAreaName);
    const v = clubCountryVotesRaw.get(p.globalClubId) ?? new Map();
    v.set(ctry, (v.get(ctry) ?? 0) + 1);
    clubCountryVotesRaw.set(p.globalClubId, v);
  }

  // union-find over clubs
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const c of raw.global.clubs) if (!CLUB_DROP.has(c.globalClubId)) parent.set(c.globalClubId, c.globalClubId);
  // connect clubs that share a coach (same country only)
  const coachSeed = new Map(); // coachId -> representative clubId
  for (const [cid, coaches] of clubCoaches) {
    if (!parent.has(cid)) continue;
    for (const co of coaches) {
      const prev = coachSeed.get(co);
      if (prev && countryOfClub({ globalClubId: prev }) === countryOfClub({ globalClubId: cid })) union(cid, prev);
      else if (!prev) coachSeed.set(co, cid);
    }
  }
  // connect clubs with an identical stripped-name root (catches coachless dups).
  // Federation team-clubs are EXCLUDED here: stripping "wushu/federation/team"
  // reduces e.g. "Kutaisi Wushu Federation Team" to just "kutaisi", which would
  // wrongly bridge it to a same-city club. They only absorb their real
  // spelling-variants via the shared-coach union above.
  const rootSeed = new Map();
  for (const c of raw.global.clubs) {
    if (CLUB_DROP.has(c.globalClubId) || FEDERATION_TEAM_CLUBS[c.globalClubId]) continue;
    const k = looseName(c.normalizedClubKey, CLUB_STOP);
    if (!k) continue;
    const prev = rootSeed.get(k);
    if (prev) union(c.globalClubId, prev); else rootSeed.set(k, c.globalClubId);
  }

  const components = new Map();
  for (const c of raw.global.clubs) {
    if (CLUB_DROP.has(c.globalClubId)) continue;
    const r = find(c.globalClubId);
    if (!components.has(r)) components.set(r, []);
    components.get(r).push(c);
  }
  const clubRemap = new Map();
  for (const members of components.values()) {
    if (members.length < 2) continue;
    // Survivor: prefer a curated/federation club, then most-seen, then cleanest name.
    const canon = members.slice().sort((x, y) =>
      ((CLUB_OVERRIDES[y.globalClubId] || FEDERATION_TEAM_CLUBS[y.globalClubId]) ? 1 : 0) -
      ((CLUB_OVERRIDES[x.globalClubId] || FEDERATION_TEAM_CLUBS[x.globalClubId]) ? 1 : 0) ||
      (y.sourceEventCount ?? 0) - (x.sourceEventCount ?? 0) ||
      (y.canonicalName?.length ?? 0) - (x.canonicalName?.length ?? 0) ||
      x.globalClubId.localeCompare(y.globalClubId))[0];
    for (const m of members) {
      if (m.globalClubId === canon.globalClubId) continue;
      clubRemap.set(m.globalClubId, canon.globalClubId);
      warn(`merged club "${m.canonicalName}" (${m.globalClubId}) -> "${canon.canonicalName}"`);
    }
  }
  if (clubRemap.size) {
    const R = (id) => (id == null ? id : (clubRemap.get(id) ?? id));
    raw.global.clubs = raw.global.clubs.filter((c) => !clubRemap.has(c.globalClubId));
    for (const ev of raw.events ?? []) {
      for (const p of ev.eventParticipants ?? []) p.globalClubId = R(p.globalClubId);
      for (const r of ev.registrations ?? []) r.globalClubId = R(r.globalClubId);
    }
    warn(`club dedup: ${clubRemap.size} merged; ${raw.global.clubs.length} clubs remain`);
  }

  // ---- COACHES (runs after clubs so club ids are canonical) ---------------
  // A coach belongs to one club, so two coach rows in the SAME club whose names
  // are near-identical (OCR/transliteration drift: Faig/Paig Mamedov,
  // Banetashvili/Banetishvili) are the same person. Also collapse exact
  // loose-name matches regardless of club.
  const lev = (a, b) => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 3) return 99;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
  };
  const tokens = (s) => new Set(looseName(s).split(' ').filter((t) => t.length >= 6));
  const sharesLongToken = (a, b) => { for (const t of tokens(a)) if (tokens(b).has(t)) return true; return false; };
  // coach -> set of canonical clubs
  const coachClubs = new Map();
  for (const ev of raw.events ?? []) for (const p of ev.eventParticipants ?? []) {
    if (!p.globalClubId) continue;
    for (const co of p.globalCoachIds ?? []) { if (!coachClubs.has(co)) coachClubs.set(co, new Set()); coachClubs.get(co).add(p.globalClubId); }
  }
  const cParent = new Map();
  const cFind = (x) => { while (cParent.get(x) !== x) { cParent.set(x, cParent.get(cParent.get(x))); x = cParent.get(x); } return x; };
  const cUnion = (a, b) => { const ra = cFind(a), rb = cFind(b); if (ra !== rb) cParent.set(ra, rb); };
  for (const c of raw.global.coaches) cParent.set(c.globalCoachId, c.globalCoachId);
  // exact loose-name union
  const cByName = new Map();
  for (const c of raw.global.coaches) {
    const k = looseName(c.normalizedNameKey);
    if (!k) continue;
    if (cByName.has(k)) cUnion(c.globalCoachId, cByName.get(k)); else cByName.set(k, c.globalCoachId);
  }
  // shared-club + fuzzy-name union
  const overlapSet = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };
  for (let i = 0; i < raw.global.coaches.length; i++) {
    for (let j = i + 1; j < raw.global.coaches.length; j++) {
      const a = raw.global.coaches[i], b = raw.global.coaches[j];
      const ca = coachClubs.get(a.globalCoachId), cb = coachClubs.get(b.globalCoachId);
      if (!ca || !cb || !overlapSet(ca, cb)) continue;
      const la = looseName(a.normalizedNameKey), lb = looseName(b.normalizedNameKey);
      if (lev(la, lb) <= 3 || sharesLongToken(a.normalizedNameKey, b.normalizedNameKey)) cUnion(a.globalCoachId, b.globalCoachId);
    }
  }
  const cComp = new Map();
  for (const c of raw.global.coaches) { const r = cFind(c.globalCoachId); if (!cComp.has(r)) cComp.set(r, []); cComp.get(r).push(c); }
  const cRemap = new Map();
  for (const members of cComp.values()) {
    if (members.length < 2) continue;
    const canon = members.slice().sort((x, y) =>
      (y.sourceEventCount ?? 0) - (x.sourceEventCount ?? 0) ||
      x.globalCoachId.localeCompare(y.globalCoachId))[0];
    for (const m of members) {
      if (m.globalCoachId === canon.globalCoachId) continue;
      cRemap.set(m.globalCoachId, canon.globalCoachId);
      warn(`merged coach ${m.canonicalName} (${m.globalCoachId}) -> ${canon.canonicalName}`);
    }
  }
  if (cRemap.size) {
    const R = (id) => (id == null ? id : (cRemap.get(id) ?? id));
    const uniq = (arr) => [...new Set((arr ?? []).map(R))];
    raw.global.coaches = raw.global.coaches.filter((c) => !cRemap.has(c.globalCoachId));
    for (const ev of raw.events ?? []) {
      for (const p of ev.eventParticipants ?? []) if (p.globalCoachIds) p.globalCoachIds = uniq(p.globalCoachIds);
      for (const r of ev.registrations ?? []) if (r.globalCoachIds) r.globalCoachIds = uniq(r.globalCoachIds);
    }
    warn(`coach dedup: ${cRemap.size} merged; ${raw.global.coaches.length} coaches remain`);
  }
}

// ---------------------------------------------------------------------------
// Pass 1 — collect per-athlete source names & dobs across both events
// ---------------------------------------------------------------------------
const partsByAthlete = new Map(); // globalAthleteId -> [{ev, name, dob, area, clubId}]
const clubCountryVotes = new Map(); // globalClubId -> Map(country->count)
const clubMuniVotes = new Map();    // globalClubId -> Map(municipalityEn->count)
const coachClubVotes = new Map();   // globalCoachId -> Map(clubId->count)
const athleteCoachKeys = new Map(); // globalAthleteId -> Set(globalCoachId)

for (const ev of raw.events) {
  const evKey = ev.event.eventKey;
  for (const p of ev.eventParticipants ?? []) {
    if (!p.globalAthleteId) continue;
    const list = partsByAthlete.get(p.globalAthleteId) ?? [];
    list.push({
      ev: evKey,
      name: p.sourceName,
      dob: p.sourceDateOfBirth,
      area: p.sourceAreaName,
      clubId: p.globalClubId,
    });
    partsByAthlete.set(p.globalAthleteId, list);

    const club = resolveClub(p.globalClubId);
    if (club) {
      const country = areaToCountry(p.sourceAreaName);
      const votes = clubCountryVotes.get(club) ?? new Map();
      votes.set(country, (votes.get(country) ?? 0) + 1);
      clubCountryVotes.set(club, votes);

      // Georgian municipality from the area column (Tbilisi sheet only).
      const muni = MUNICIPALITY[(p.sourceAreaName ?? '').trim()];
      if (muni) {
        const mv = clubMuniVotes.get(club) ?? new Map();
        mv.set(muni.en, (mv.get(muni.en) ?? 0) + 1);
        clubMuniVotes.set(club, mv);
      }
    }

    // Coach -> club association (majority vote across participations) and the
    // athlete -> coaches set (many-to-many).
    for (const coachId of p.globalCoachIds ?? []) {
      if (club) {
        const cv = coachClubVotes.get(coachId) ?? new Map();
        cv.set(club, (cv.get(club) ?? 0) + 1);
        coachClubVotes.set(coachId, cv);
      }
      const set = athleteCoachKeys.get(p.globalAthleteId) ?? new Set();
      set.add(coachId);
      athleteCoachKeys.set(p.globalAthleteId, set);
    }
  }
}

// Majority-vote helper (ties prefer a non-GE country / any non-null).
function topVote(map, { preferNonGE = false } = {}) {
  let best = -1;
  let winner = null;
  for (const [k, n] of map ?? []) {
    if (n > best || (n === best && preferNonGE && k !== 'GE')) { best = n; winner = k; }
  }
  return winner;
}

const isTbilisi = (evKey) => evKey?.startsWith('tbilisi');

function pickName(list) {
  // Prefer Georgian source from Tbilisi, Latin source from Batumi.
  const ka = list.find((x) => isGeorgian(x.name))?.name ?? null;
  const en = list.find((x) => x.name && !isGeorgian(x.name))?.name ?? null;
  return { ka, en };
}

// ---------------------------------------------------------------------------
// Countries / Regions
// ---------------------------------------------------------------------------
const usedCountries = new Set();
const usedCities = new Map();    // cityKey -> { key, countryCode, name, nameKa }
const usedAgeGroups = new Set();  // `${sex}|${ageGroupKey}`
const usedCategories = new Map(); // canonicalKey -> {sex, ageGroupKey, weightKey}

// Resolve a region key for a club (real Georgian municipality where known, else
// the country as its own region for foreign clubs) and register it.
function registerCity(countryCode, municipalityEn) {
  if (countryCode === 'GE' && municipalityEn) {
    const m = muniByEn.get(municipalityEn);
    const key = `GE:${municipalityEn}`;
    if (!usedCities.has(key)) usedCities.set(key, { key, countryCode: 'GE', name: m.en, nameKa: m.ka });
    return key;
  }
  // Foreign country = its own single region.
  if (!usedCities.has(countryCode)) {
    usedCities.set(countryCode, {
      key: countryCode,
      countryCode,
      name: COUNTRY_META[countryCode].name,
      nameKa: COUNTRY_META[countryCode].nameKa,
    });
  }
  return countryCode;
}
function clubCityKey(clubKey, countryCode) {
  if (countryCode !== 'GE') return registerCity(countryCode, null);
  const muni =
    topVote(clubMuniVotes.get(clubKey)) ??
    CLUB_REGION_OVERRIDE[clubKey] ??
    'Tbilisi'; // last-resort default for an unknown Georgian club
  return registerCity('GE', muni);
}

// Precompute each surviving club's country + region so athletes/clubs/coaches
// all share one consistent geography.
const clubGeo = new Map(); // clubKey -> { countryCode, cityKey }
for (const c of raw.global.clubs) {
  if (CLUB_DROP.has(c.globalClubId) || CLUB_MERGE[c.globalClubId]) continue;
  const countryCode = topVote(clubCountryVotes.get(c.globalClubId), { preferNonGE: true }) ?? 'GE';
  usedCountries.add(countryCode);
  clubGeo.set(c.globalClubId, { countryCode, cityKey: clubCityKey(c.globalClubId, countryCode) });
}

// ---------------------------------------------------------------------------
// Athletes
// ---------------------------------------------------------------------------
const athletes = [];
const docIds = new Set();

for (const a of raw.global.athletes) {
  const list = partsByAthlete.get(a.globalAthleteId) ?? [];
  const { ka, en } = pickName(list);

  let enName = en;
  let kaName = ka;
  if (!enName && kaName) enName = kaToLatin(kaName);
  if (!kaName && enName) kaName = latinToKa(enName);
  if (!enName && !kaName) {
    enName = a.canonicalName;
    kaName = isGeorgian(a.canonicalName) ? a.canonicalName : latinToKa(a.canonicalName);
    if (isGeorgian(enName)) enName = kaToLatin(enName);
  }

  const enSplit = splitName(enName, { latin: true });
  const kaSplit = splitName(kaName, { latin: false });
  if (!enSplit.last) warn(`athlete ${a.globalAthleteId}: single-token name "${enName}" (empty last name)`);

  // DOB: canonical, else Tbilisi source, else any source.
  let dob = a.dateOfBirth;
  if (!dob) {
    const tb = list.find((x) => isTbilisi(x.ev) && x.dob)?.dob;
    dob = tb ?? list.find((x) => x.dob)?.dob ?? null;
    if (dob) warn(`athlete ${a.globalAthleteId}: DOB recovered from source row -> ${dob}`);
  }
  if (!dob) {
    warn(`athlete ${a.globalAthleteId}: NO DOB anywhere — skipped`);
    continue;
  }

  const clubKey = resolveClub(list.find((x) => x.clubId)?.clubId ?? null);

  // Geography: inherit the club's where the athlete has one; otherwise derive
  // from the athlete's own source area (country + Georgian municipality).
  let country;
  let cityKey;
  if (clubKey && clubGeo.has(clubKey)) {
    ({ countryCode: country, cityKey } = clubGeo.get(clubKey));
  } else {
    const countryCounts = new Map();
    for (const x of list) countryCounts.set(areaToCountry(x.area), (countryCounts.get(areaToCountry(x.area)) ?? 0) + 1);
    country = topVote(countryCounts, { preferNonGE: true }) ?? 'GE';
    const muniKa = list.map((x) => MUNICIPALITY[(x.area ?? '').trim()]).find(Boolean);
    cityKey = registerCity(country, country === 'GE' ? (muniKa?.en ?? 'Tbilisi') : null);
  }
  usedCountries.add(country);

  // Real OCR'd document ID where available, else a stable synthetic placeholder.
  let docId = realIds.get(a.globalAthleteId);
  if (!docId) {
    const hash = a.globalAthleteId.split('_').pop();
    docId = `IMPORT-${hash.toUpperCase()}`;
  }
  while (docIds.has(docId)) docId = `${docId}-X`;
  docIds.add(docId);

  athletes.push({
    key: a.globalAthleteId,
    documentId: docId,
    firstName: enSplit.first || enName,
    lastName: enSplit.last,
    firstNameKa: kaSplit.first || kaName,
    lastNameKa: kaSplit.last,
    sex: a.gender, // MALE | FEMALE
    dateOfBirth: dob,
    countryCode: country,
    cityKey,
    clubKey,
    coachKeys: [...(athleteCoachKeys.get(a.globalAthleteId) ?? [])],
  });
}

// ---------------------------------------------------------------------------
// Clubs
// ---------------------------------------------------------------------------
const clubs = [];
for (const c of raw.global.clubs) {
  if (CLUB_DROP.has(c.globalClubId)) continue;       // junk "None" club
  if (CLUB_MERGE[c.globalClubId]) continue;          // folded into its canonical twin

  const geo = clubGeo.get(c.globalClubId) ?? { countryCode: 'GE', cityKey: registerCity('GE', 'Tbilisi') };
  const country = geo.countryCode;

  const override = CLUB_OVERRIDES[c.globalClubId];
  let name;
  let nameKa;
  if (override) {
    name = override.name;
    nameKa = override.nameKa ?? null;
  } else {
    // Fallback: bilingual name from aliases raw names (no curated override).
    warn(`club ${c.globalClubId}: no curated name override — derived from source`);
    const rawNames = (c.aliases ?? []).flatMap((al) => al.rawNames ?? [al.name]).filter(Boolean);
    const kaRaw = rawNames.find((n) => isGeorgian(n)) ?? (isGeorgian(c.canonicalName) ? c.canonicalName : null);
    const enRaw = rawNames.find((n) => n && !isGeorgian(n)) ?? (!isGeorgian(c.canonicalName) ? c.canonicalName : null);
    name = enRaw || (kaRaw ? kaToLatin(kaRaw) : c.canonicalName);
    nameKa = kaRaw ?? (country === 'GE' ? latinToKa(name) : null);
  }

  // Only the four federation-entries get a federationKey (their own team-club);
  // every other club is independent (null). No per-city synthetic federation.
  clubs.push({ key: c.globalClubId, name, nameKa, countryCode: country, cityKey: geo.cityKey, federationKey: FEDERATION_TEAM_CLUBS[c.globalClubId] ?? null });
}

// ---------------------------------------------------------------------------
// Coaches -> User accounts (role=coach), one per global coach, attached to the
// club they coach the most athletes in.
// ---------------------------------------------------------------------------
const coaches = [];
const coachEmails = new Set();
const slug = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'coach';

for (const c of raw.global.coaches) {
  const rawNames = (c.aliases ?? []).flatMap((al) => al.rawNames ?? [al.name]).filter(Boolean);
  const kaRaw = rawNames.find((n) => isGeorgian(n)) ?? (isGeorgian(c.canonicalName) ? c.canonicalName : null);
  const enRaw = rawNames.find((n) => n && !isGeorgian(n)) ?? (!isGeorgian(c.canonicalName) ? c.canonicalName : null);
  let displayName = enRaw || (kaRaw ? kaToLatin(kaRaw) : c.canonicalName);
  let displayNameKa = kaRaw ?? (enRaw ? latinToKa(enRaw) : null);
  // Title-case the EN display name token-wise.
  displayName = displayName.split(/\s+/).map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(' ');

  const clubKey = topVote(coachClubVotes.get(c.globalCoachId));
  const geo = clubKey ? clubGeo.get(clubKey) : null;
  const countryCode = geo?.countryCode ?? 'GE';
  usedCountries.add(countryCode);

  let email = `${slug(displayName)}@coach.gwf.ge`;
  while (coachEmails.has(email)) email = email.replace('@', `.${coachEmails.size}@`);
  coachEmails.add(email);

  coaches.push({
    key: c.globalCoachId,
    displayName,
    displayNameKa,
    email,
    clubKey: clubKey ?? null,
    countryCode,
    cityKey: geo?.cityKey ?? registerCity(countryCode, countryCode === 'GE' ? 'Tbilisi' : null),
    nationality: countryCode === 'GE' ? 'GE' : null,
  });
}

// ---------------------------------------------------------------------------
// Events (categories, registrations, weigh-ins, fights)
// ---------------------------------------------------------------------------
const EVENT_DATES = {
  tbilisi_sanda_14_open_2024: {
    name: 'Tbilisi 14th Wushu Open Championship 2024',
    nameKa: 'თბილისის უშუს XIV ღია პირველობა',
    slug: 'tbilisi-14th-wushu-open-2024',
    location: 'Tbilisi, Georgia',
    start: '2024-02-09', end: '2024-02-11',
  },
  georgia_8_cup_sanda_2024: {
    name: 'Georgia 8th Wushu Cup 2024',
    nameKa: 'საქართველოს უშუს მე-8 თასის გათამაშება',
    slug: 'georgia-8th-wushu-cup-2024',
    location: 'Tbilisi, Georgia',
    start: '2024-03-15', end: '2024-03-17',
  },
  ananuri_open_sanda_2024: {
    name: '300 Aragveli Memorial Open Wushu Sanda Tournament 2024',
    nameKa: '300 არაგველის ხსოვნისადმი მიძღვნილი ღია ტურნირი უშუ-სანდაში 2024',
    slug: 'ananuri-open-wushu-sanda-2024',
    location: 'Ananuri, Georgia',
    start: '2024-06-15', end: '2024-06-16',
  },
  batumi_open_sanda_2024: {
    name: 'Batumi Open International Wushu Tournament 2024',
    nameKa: 'ბათუმის ღია საერთაშორისო უშუს ტურნირი 2024',
    slug: 'batumi-open-wushu-2024',
    location: 'Batumi, Georgia',
    start: '2024-10-17', end: '2024-10-22',
  },
  georgia_championship_sanda_2024: {
    name: 'Georgia 21st National Wushu Championship 2024',
    nameKa: 'საქართველოს უშუს 21-ე ეროვნული ჩემპიონატი',
    slug: 'georgia-national-wushu-championship-2024',
    location: 'Tbilisi, Georgia',
    start: '2024-12-13', end: '2024-12-15',
  },
  tbilisi_sanda_15_open_2025: {
    name: 'Tbilisi 15th Wushu Open Championship 2025',
    nameKa: 'თბილისის უშუს მე-15 ღია პირველობა',
    slug: 'tbilisi-15th-wushu-open-2025',
    location: 'Tbilisi, Georgia',
    start: '2025-01-31', end: '2025-02-02',
  },
  georgia_cup_sanda_2025: {
    name: 'Georgia 9th Wushu Cup 2025',
    nameKa: 'საქართველოს უშუს მე-9 თასის გათამაშება',
    slug: 'georgia-9th-wushu-cup-2025',
    location: 'Tbilisi, Georgia',
    start: '2025-04-15', end: '2025-04-17',
  },
  kutaisi_open_sanda_2025: {
    name: 'Kutaisi 11th Open Sanda Championship 2025',
    nameKa: 'ქუთაისის სანდას მე-11 ღია პირველობა',
    slug: 'kutaisi-11th-open-sanda-2025',
    location: 'Kutaisi, Georgia',
    start: '2025-05-31', end: '2025-06-01',
  },
  batumi_open_sanda_2025_template_source: {
    name: 'Batumi Open International Wushu Tournament 2025',
    nameKa: 'ბათუმის ღია საერთაშორისო უშუს ტურნირი 2025',
    slug: 'batumi-open-wushu-2025',
    location: 'Batumi, Georgia',
    start: '2025-08-01', end: '2025-08-06',
  },
  georgia_championship_sanda_2025: {
    name: 'Georgia 22nd National Wushu Championship 2025',
    nameKa: 'საქართველოს უშუს 22-ე ეროვნული ჩემპიონატი',
    slug: 'georgia-national-wushu-championship-2025',
    location: 'Tbilisi, Georgia',
    start: '2025-12-05', end: '2025-12-07',
  },
  tbilisi_sanda_16_open_2026: {
    name: 'Tbilisi 16th Wushu Open Championship 2026',
    nameKa: 'თბილისის უშუს მე-16 ღია პირველობა',
    slug: 'tbilisi-16th-wushu-open-2026',
    location: 'Tbilisi, Georgia',
    start: '2026-02-06', end: '2026-02-08',
  },
};
const daysBefore = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const REG_STATUS = { REGISTERED: 'APPROVED', NOT_COMPETING: 'WITHDRAWN' };

function canonCat(sex, ageGroupKey, weightKey) {
  if (!sex || !ageGroupKey || !weightKey) return null;
  if (ageGroupKey === 'არ გამოდის') return null; // "does not compete" sentinel
  if (!AGE_GROUPS[ageGroupKey]) { warn(`unknown age group "${ageGroupKey}"`); return null; }
  if (!weightBounds(weightKey)) { warn(`unknown weight "${weightKey}"`); return null; }
  // "|" separator: age-group keys (e.g. "18_") and weight keys (e.g. "_65")
  // both contain "_", so "_" / "__" are ambiguous to parse back. "|" is safe.
  return `${sex}|${ageGroupKey}|${weightKey}`;
}
function registerCat(sex, ageGroupKey, weightKey) {
  const key = canonCat(sex, ageGroupKey, weightKey);
  if (!key) return null;
  usedAgeGroups.add(`${sex}|${ageGroupKey}`);
  if (!usedCategories.has(key)) usedCategories.set(key, { sex, ageGroupKey, weightKey });
  return key;
}

const sexByAthlete = new Map(athletes.map((a) => [a.key, a.sex]));
const events = [];

for (const ev of raw.events) {
  const evKey = ev.event.eventKey;
  const meta = EVENT_DATES[evKey];
  if (!meta) { warn(`no date meta for event ${evKey}`); continue; }

  // Registrations — deduped per athlete (the source has a few false-merges
  // where one globalAthleteId covers two people; keep the competing/first row
  // so the DB @@unique([eventId, athleteId]) holds).
  const regByAthlete = new Map();
  for (const r of ev.registrations) {
    const sex = sexByAthlete.get(r.globalAthleteId);
    if (!sex) { warn(`reg ${r.eventRegistrationKey}: athlete ${r.globalAthleteId} not in athlete set`); continue; }
    const finalKey = registerCat(sex, r.finalAgeCategory, r.finalWeightCategory);
    const regKey = registerCat(sex, r.preliminaryAgeCategory, r.registeredWeightCategory);
    const row = {
      athleteKey: r.globalAthleteId,
      clubKey: resolveClub(r.globalClubId ?? null),
      status: REG_STATUS[r.status] ?? 'APPROVED',
      registeredCategoryKey: regKey,
      finalCategoryKey: finalKey,
      categoryCode: finalKey ?? regKey ?? `${sex}_${r.preliminaryAgeCategory ?? '?'}`,
      actualWeightKg: r.actualWeightKg ?? null,
    };
    const existing = regByAthlete.get(r.globalAthleteId);
    if (!existing) { regByAthlete.set(r.globalAthleteId, row); continue; }
    warn(`${evKey} reg: duplicate athlete ${r.globalAthleteId} (source false-merge) — kept ${existing.status}, dropped ${row.status}`);
    if (existing.status !== 'APPROVED' && row.status === 'APPROVED') regByAthlete.set(r.globalAthleteId, row);
  }
  const registrations = [...regByAthlete.values()];

  // Weigh-ins (only for those with a weight; competing -> PASS). Deduped per
  // athlete to match the registration set.
  const weighByAthlete = new Map();
  for (const w of ev.weighIns) {
    if (w.actualWeightKg == null) continue;
    const row = {
      athleteKey: w.globalAthleteId,
      weightKg: w.actualWeightKg,
      competing: w.statusAfterWeighIn === 'REGISTERED',
    };
    const existing = weighByAthlete.get(w.globalAthleteId);
    if (!existing || (!existing.competing && row.competing)) weighByAthlete.set(w.globalAthleteId, row);
  }
  const weighIns = [...weighByAthlete.values()];

  // Fights grouped by category. The source "round" is the schedule round, not
  // the bracket round, so for single-elimination we RECONSTRUCT bracket rounds
  // from the actual win/loss graph (the results logic keys gold/silver off the
  // single fight at the highest round, and bronze off the round below).
  const rawByCat = new Map();
  for (const f of ev.fights) {
    const catKey = registerCat(f.gender, f.ageGroupKey, f.weightCategoryKey);
    const red = f.red?.globalAthleteId ?? null;
    const blue = f.blue?.globalAthleteId ?? null;
    if (!catKey || !red || !blue) { warn(`fight ${f.eventFightKey}: missing cat/athletes — skipped`); continue; }
    const winnerSide = f.result?.winnerSide ?? null;
    const arr = rawByCat.get(catKey) ?? [];
    arr.push({
      fightNo: f.fightNo ?? 0,
      redAthleteKey: red,
      blueAthleteKey: blue,
      winnerAthleteKey: winnerSide === 'RED' ? red : winnerSide === 'BLUE' ? blue : null,
      redScore: f.result?.redScoreRaw ?? null,
      blueScore: f.result?.blueScoreRaw ?? null,
    });
    rawByCat.set(catKey, arr);
  }

  const fights = [];
  for (const [catKey, catFights] of rawByCat) {
    const athleteSet = new Set();
    const wins = new Map();
    const losses = new Map();
    for (const f of catFights) {
      athleteSet.add(f.redAthleteKey);
      athleteSet.add(f.blueAthleteKey);
      if (f.winnerAthleteKey) {
        const loser = f.winnerAthleteKey === f.redAthleteKey ? f.blueAthleteKey : f.redAthleteKey;
        wins.set(f.winnerAthleteKey, (wins.get(f.winnerAthleteKey) ?? 0) + 1);
        losses.set(loser, (losses.get(loser) ?? 0) + 1);
      }
    }
    const n = athleteSet.size;

    // Assign a bracket round to each fight.
    if (n <= 3) {
      // DIRECT_FINAL (<=2) / ROUND_ROBIN (3): the results logic ignores rounds
      // for these (single fight / standings), so a flat round is correct.
      catFights.forEach((f) => (f.round = 1));
    } else {
      // SINGLE_ELIMINATION: reconstruct bracket rounds from the winner-
      // advancement graph. Each fight's winner advances to their next bout;
      // a fight's round = (distance back from the final). This correctly handles
      // byes — e.g. with 5 athletes it yields QF(1) → SF(2) → Final(1), so both
      // semifinal losers get bronze (the old win-rank heuristic collapsed the
      // semifinal to one fight, producing a lopsided tree and only one bronze).
      const champs = [...athleteSet].filter((a) => (losses.get(a) ?? 0) === 0);
      if (champs.length !== 1) {
        warn(`${evKey} ${catKey}: ${champs.length} unbeaten athletes (expected 1) — bracket may be irregular`);
      }

      const byFightNo = [...catFights].sort((a, b) => a.fightNo - b.fightNo);
      // The fight each winner advances into = their next appearance afterwards.
      const nextOf = new Map();
      for (const f of byFightNo) {
        const w = f.winnerAthleteKey;
        if (!w) continue;
        const nxt = byFightNo.find(
          (g) => g.fightNo > f.fightNo && (g.redAthleteKey === w || g.blueAthleteKey === w),
        );
        if (nxt) nextOf.set(f, nxt);
      }
      // Hops from a fight forward to the terminal (the final) — final = 0.
      const distToFinal = (f) => {
        let d = 0;
        let cur = f;
        let guard = 0;
        while (nextOf.get(cur) && guard++ < 1000) { cur = nextOf.get(cur); d++; }
        return d;
      };
      const dist = new Map(catFights.map((f) => [f, distToFinal(f)]));
      const maxDist = Math.max(0, ...dist.values());
      for (const f of catFights) f.round = maxDist - dist.get(f) + 1;

      // Byes: an athlete whose first real fight is in round r > 1 advanced
      // without fighting in round r-1 — a bye. Represent it the way the app
      // does: a single-sided fight (one athlete, the other slot empty) that
      // auto-advances. This rebuilds the balanced bracket so byes show + count
      // (5 athletes → 3 byes, etc.). Derived from the real fight structure, not
      // a sheet column (the sheets carry no bye marker).
      const entryRound = new Map();
      for (const f of catFights) {
        for (const a of [f.redAthleteKey, f.blueAthleteKey]) {
          if (a) entryRound.set(a, Math.min(entryRound.get(a) ?? Infinity, f.round));
        }
      }
      let byeSeq = 0;
      for (const [a, er] of entryRound) {
        if (er > 1) {
          catFights.push({
            fightNo: 1e9 + byeSeq++, // sort after real fights within the round
            round: er - 1,
            redAthleteKey: a,
            blueAthleteKey: null,
            winnerAthleteKey: a,
            redScore: null,
            blueScore: null,
            isBye: true,
          });
        }
      }
    }

    // Renumber bouts per round by schedule order.
    const byRound = new Map();
    for (const f of catFights) {
      const arr = byRound.get(f.round) ?? [];
      arr.push(f);
      byRound.set(f.round, arr);
    }
    for (const arr of byRound.values()) {
      arr.sort((a, b) => a.fightNo - b.fightNo);
      arr.forEach((f, i) => {
        fights.push({
          categoryKey: catKey,
          round: f.round,
          boutNo: i + 1,
          redAthleteKey: f.redAthleteKey,
          blueAthleteKey: f.blueAthleteKey ?? null,
          winnerAthleteKey: f.winnerAthleteKey,
          winMethod: f.isBye ? 'WO' : 'POINTS',
          redScore: f.redScore,
          blueScore: f.blueScore,
          isBye: f.isBye ?? false,
        });
      });
    }
  }

  events.push({
    key: evKey,
    name: meta.name,
    nameKa: meta.nameKa,
    slug: meta.slug,
    location: meta.location,
    timezone: ev.event.timezone ?? 'Asia/Tbilisi',
    competitionStartDate: meta.start,
    competitionEndDate: meta.end,
    registrationStartDate: daysBefore(meta.start, 30),
    registrationEndDate: daysBefore(meta.start, 2),
    weighInStartDate: daysBefore(meta.start, 1),
    weighInEndDate: meta.start,
    registrations,
    weighIns,
    fights,
  });
}

// ---------------------------------------------------------------------------
// Build the shared category template from used categories
// ---------------------------------------------------------------------------
const ageGroupRows = [];
for (const sa of usedAgeGroups) {
  const [sex, ageGroupKey] = sa.split('|');
  const meta = AGE_GROUPS[ageGroupKey];
  ageGroupRows.push({
    code: `${sex}_${ageGroupKey}`,
    sex,
    ageGroupKey,
    name: `${meta.name} (${sex === 'MALE' ? 'Boys/Men' : 'Girls/Women'})`,
    nameKa: meta.nameKa,
    minAge: meta.minAge,
    maxAge: meta.maxAge,
    roundDurationSeconds: meta.round,
    sortOrder: meta.sort * 10 + (sex === 'MALE' ? 0 : 1),
    weights: [],
  });
}
const ageGroupByCode = new Map(ageGroupRows.map((g) => [g.code, g]));
for (const { sex, ageGroupKey, weightKey } of usedCategories.values()) {
  const g = ageGroupByCode.get(`${sex}_${ageGroupKey}`);
  const b = weightBounds(weightKey);
  g.weights.push({
    weightKey,
    name: b.name,
    nameKa: b.nameKa,
    minWeightKgExcl: b.minKg,
    maxWeightKgIncl: b.maxKg,
    sortOrder: weightSort(weightKey),
  });
}
for (const g of ageGroupRows) {
  g.weights.sort((a, b) => a.sortOrder - b.sortOrder);
  g.canonByWeight = undefined;
}
ageGroupRows.sort((a, b) => a.sortOrder - b.sortOrder);

// Countries + cities actually used
const countries = [...usedCountries].sort().map((code) => ({
  code,
  name: COUNTRY_META[code].name,
  nameKa: COUNTRY_META[code].nameKa,
}));
const cities = [...usedCities.values()].sort((a, b) =>
  a.countryCode === b.countryCode ? a.name.localeCompare(b.name) : a.countryCode.localeCompare(b.countryCode),
);

// Federations: exactly the four real ones (City → Federation → Club). Every
// other club is independent. Keep only feds whose host city exists and that are
// actually referenced by a team-club, so we never emit an empty federation.
const referencedFedKeys = new Set(clubs.map((c) => c.federationKey).filter(Boolean));
const cityKeysAvail = new Set(cities.map((c) => c.key));
const federations = REAL_FEDERATIONS.filter(
  (f) => cityKeysAvail.has(f.cityKey) && referencedFedKeys.has(f.key),
);
const federationKeys = new Set(federations.map((f) => f.key));
// Safety: drop any dangling federationKey not backed by a federation row.
for (const c of clubs) {
  if (c.federationKey && !federationKeys.has(c.federationKey)) c.federationKey = null;
}

// Attach majority clubKey already set on athletes; ensure club exists.
const clubKeys = new Set(clubs.map((c) => c.key));
for (const a of athletes) {
  if (a.clubKey && !clubKeys.has(a.clubKey)) { warn(`athlete ${a.key}: club ${a.clubKey} missing`); a.clubKey = null; }
}

const out = {
  meta: {
    source: 'source-export.json (wushu_sanda_GLOBAL_DEDUPED_import_v2_FINAL)',
    generatedAt: new Date().toISOString(),
    note: 'documentId synthesized (no national IDs in source); names bilingual via cross-event source + transliteration; medals are app-derived from these confirmed fights.',
    counts: {},
  },
  organisation: { name: 'Georgian Wushu Federation', slug: 'georgian-wushu-federation' },
  countries,
  cities,
  federations,
  clubs,
  coaches,
  categoryTemplate: { name: 'Imported Sanda Categories (2024-2026)', ageGroups: ageGroupRows },
  athletes,
  events,
};
out.meta.counts = {
  countries: countries.length,
  cities: cities.length,
  federations: federations.length,
  clubs: clubs.length,
  coaches: coaches.length,
  athletes: athletes.length,
  ageGroups: ageGroupRows.length,
  categories: usedCategories.size,
  events: events.length,
  registrations: events.reduce((n, e) => n + e.registrations.length, 0),
  weighIns: events.reduce((n, e) => n + e.weighIns.length, 0),
  fights: events.reduce((n, e) => n + e.fights.length, 0),
};

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('Wrote', OUT);
console.log('Counts:', JSON.stringify(out.meta.counts, null, 2));
console.log(`\nWarnings (${warnings.length}):`);
for (const w of warnings.slice(0, 40)) console.log('  -', w);
if (warnings.length > 40) console.log(`  ... and ${warnings.length - 40} more`);
