// Builds source-export.json from the Google Drive Sanda workbooks.
//
// This is intentionally JS-only and dependency-free: it uses curl to download
// temporary XLSX exports and unzip to read the workbook XML. It preserves the
// existing two 2025 event exports, then appends the missing 2024/2025/2026
// events in the same raw shape consumed by build-seed.mjs.
//
// Private Drive files can be placed in:
//   /tmp/wushu-drive-source/<eventKey>.xlsx
// before running this script.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isGeorgian, kaToLatin } from './transliterate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, 'source-export.json');
const OUT = SRC;
const TMP = join(tmpdir(), 'wushu-drive-source');
mkdirSync(TMP, { recursive: true });

const existing = JSON.parse(readFileSync(SRC, 'utf8'));

const EVENTS = [
  {
    eventKey: 'tbilisi_sanda_14_open_2024',
    spreadsheetId: '1JMoDLJZ8aXYLuDrmsU3TFPzikoF7rcSh7C-iLgRm12g',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'georgia_8_cup_sanda_2024',
    spreadsheetId: '1_DBHBucQ43J3nmx2bCzb7Y8C6bOEzJwt9gaYR6PODmg',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'ananuri_open_sanda_2024',
    spreadsheetId: '1treuFCWfsTWY-8oOEX3TP1jj8tdzO_juHcy96nCAdy8',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'batumi_open_sanda_2024',
    spreadsheetId: '1LsRWV7EoshXAMy_jeRRNHBBOzNcHzywvik0wSwh1QIs',
    workbookTitle: 'Sanda',
  },
  {
    eventKey: 'georgia_championship_sanda_2024',
    spreadsheetId: '1nygRK8Xm3M4OhlMRreJRMhorH4TM8Y4IEndhBwW1WAo',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'georgia_cup_sanda_2025',
    spreadsheetId: '1fQESTDSAm7mvbAeT91Xl_TN1bROk1NZq620YSALR4s0',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'kutaisi_open_sanda_2025',
    spreadsheetId: '1etxXisGqciGQTHDwER241SwRNw7Oif8q64DZnBCXDNo',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'georgia_championship_sanda_2025',
    spreadsheetId: '1RWOxiXKlUYqOFyCbwUa_QpD0tjDytJ3PNEiDmq5PgEs',
    workbookTitle: 'ტურნირი  სანდა',
  },
  {
    eventKey: 'tbilisi_sanda_16_open_2026',
    spreadsheetId: '1MdOL_vTkMFBbyP472ONdlutEiJxp0rgi9lZYLjGjX98',
    workbookTitle: 'Copy of ტურნირი  სანდა',
    mayRequireLocalFile: true,
  },
];

const sha8 = (s) => createHash('sha1').update(s).digest('hex').slice(0, 8);
const clean = (s) => String(s ?? '').replace(/^"+|"+$/g, '').replace(/\s+/g, ' ').trim();
const slug = (s) =>
  clean(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

function normText(s) {
  const t = clean(s).replace(/[“”]/g, '"').replace(/\.$/, '');
  const latin = isGeorgian(t) ? kaToLatin(t) : t;
  return latin
    .toLowerCase()
    .replace(/["'`]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\bwushu\b/g, 'wushu')
    .replace(/\s+/g, ' ')
    .trim();
}

const CLUB_NORMALIZE = new Map([
  ['თბილისის უშუს ფედერაცია', 'tbilisi wushu federation'],
  ['თბილისის უშუ ფედერაცია', 'tbilisis pederatsia'],
  ['ქუთაისის უშუს ფედერაცია', 'kutaisi wushu federation'],
  ['ქუთაისის უშუ სანდას კლუბი-აიეტი-2017', 'kutaisi wushu sanda club aieti 2017'],
  ['ქუთაისის უშუს სანდას კლუბი-აიეტი-2017', 'kutaisi wushu sanda club aieti 2017'],
  ['ქყთაისის უშუს სანდას კლუბი-აიეტი-2017', 'kutaisi wushu sanda club aieti 2017'],
  ['ქუთაისის შუ სანდას კლუბი-აიეტი-2017', 'kutaisi wushu sanda club aieti 2017'],
  ['"ჭყონდიფიი', 'chqondidi'],
  ['ჭყონდიფიი', 'chqondidi'],
  ['ჭყონდიდი', 'chqondidi'],
  ['მარტვილის სასპორტო სკოლა', 'chqondidi'],
  ['კომპლექსური სასპორტო სკოლა', 'chqondidi'],
  ['წალკის სასპორტო სკოლა', 'tsalka sport school'],
  ['წალკის სასპორტო სკოლის', 'tsalkis sasporto skolis'],
  ['არწივი', 'artsivi'],
  ['ბარლას', 'barlas'],
  ['ვორიორსი', 'warriors'],
  ['ვარიორსი', 'warriors'],
  ['რაჭა კლუბი ავაზა', 'ambrolauri avaza'],
  ['ამბროლაურის კლუბი ავაზა', 'ambrolauri avaza'],
  ['დედოფლისწყარო', 'dedoflistskaro'],
  ['დედოფლისწყაროს უშუს გუნდი', 'dedoflistskaro'],
  ['ბოლნისი', 'bolnisi'],
]);

function clubNorm(raw) {
  const c = clean(raw);
  return CLUB_NORMALIZE.get(c) ?? normText(c);
}

function clubIdFor(raw) {
  const key = clubNorm(raw);
  const known = {
    'tbilisi wushu federation': 'club_tbilisi_21124c8c',
    'kutaisi wushu federation': 'club_kutaisi_31108088',
    'kutaisi wushu sanda club aieti 2017': 'club_kutaisi-aieti-2017_67fe0141',
    'tbilisis pederatsia': 'club_tbilisis-pederatsia_8807db3f',
    chqondidi: 'club_chqondidi_94e2f5f6',
    'tsalka sport school': 'club_tsalka_274787bd',
    'tsalkis sasporto skolis': 'club_tsalkis-sasporto-skolis_9d9c7a65',
    artsivi: 'club_artsivi_7e4703bf',
    barlas: 'club_barlas_c99d399b',
    warriors: 'club_warriors_014f7c10',
    'ambrolauri avaza': 'club_ambrolauri-avaza_5e83fca3',
    dedoflistskaro: 'club_dedoflistskaro_6a25ad6d',
    bolnisi: 'club_bolnisi_f81528cb',
    india: 'club_india_e074138d',
    aktau: 'club_aktau_178184bf',
    aktobe: 'club_aktobe_66f66ce2',
    shymkent: 'club_shymkent_2a444c09',
    uzbekistan: 'club_uzbekistan_d69c4971',
    'traditional of armenia': 'club_traditional-of-armenia_2847edda',
  }[key];
  if (known) return known;
  return `club_${slug(key)}_${sha8(key)}`;
}

function coachNames(raw) {
  return clean(raw)
    .split(/\s*(?:,|;|\/| და )\s*/u)
    .map((x) => clean(x))
    .filter(Boolean);
}

function coachIdFor(raw) {
  const key = normText(raw);
  return `coach_${slug(key)}_${sha8(key)}`;
}

function sex(raw) {
  const s = clean(raw).toLowerCase();
  if (s === 'გოგონები' || s === 'female' || s === 'f') return 'FEMALE';
  return 'MALE';
}

function sexPrefix(raw) {
  const s = clean(raw);
  if (s === 'გოგონები') return 'გ';
  if (/^f/i.test(s)) return 'F';
  if (/^m/i.test(s)) return 'M';
  return 'ვ';
}

function excelDate(n) {
  if (n == null || n === '') return null;
  if (typeof n === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30));
    d.setUTCDate(d.getUTCDate() + Math.floor(n));
    return d.toISOString().slice(0, 10);
  }
  const s = clean(n);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Number(clean(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function weightKey(raw) {
  const s = clean(raw).replace(',', '.').replace(/\s+/g, '');
  if (!s) return null;
  if (/^_\d+$/u.test(s)) return s;
  if (/^\d+_$/.test(s)) return s;
  const gt = /^>\s*(\d+)/.exec(s);
  if (gt) return `${gt[1]}_`;
  const lt = /^<?\s*(\d+)/.exec(s);
  if (lt && !s.includes('_')) return `_${lt[1]}`;
  const range = /^_?(\d+)_(\d+)$/.exec(s);
  if (range) return `_${range[2]}`;
  return s;
}

function divisionKey(prefix, age, weight) {
  const w = weightKey(weight);
  if (!age || !w) return null;
  return `${prefix}_${age}_${w}`;
}

function decodeXml(s) {
  return String(s ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function colNum(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d/g, '')) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

function unzip(file, member) {
  return execFileSync('unzip', ['-p', file, member], {
    encoding: 'utf8',
    maxBuffer: 200 * 1024 * 1024,
  });
}

function parseWorkbook(file) {
  const shared = [];
  try {
    const sxml = unzip(file, 'xl/sharedStrings.xml');
    for (const m of sxml.matchAll(/<si[\s\S]*?<\/si>/g)) {
      let text = '';
      for (const t of m[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += decodeXml(t[1]);
      shared.push(text);
    }
  } catch {
    // Workbooks without shared strings are valid.
  }

  const workbook = unzip(file, 'xl/workbook.xml');
  const rels = unzip(file, 'xl/_rels/workbook.xml.rels');
  const relById = new Map();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = m[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) relById.set(id, target.replace(/^\//, ''));
  }

  const sheets = new Map();
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = m[1];
    const name = decodeXml(/\bname="([^"]+)"/.exec(attrs)?.[1] ?? '');
    const rid = /\br:id="([^"]+)"/.exec(attrs)?.[1];
    const target = relById.get(rid);
    if (!name || !target) continue;
    const member = target.startsWith('xl/') ? target : `xl/${target}`;
    const rows = [];
    const sheetXml = unzip(file, member);
    for (const rowM of sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const r = Number(rowM[1]);
      const row = (rows[r - 1] ||= []);
      const rowBody = rowM[2].replace(/<c\b[^>]*\/>/g, '');
      for (const cM of rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cM[1];
        const body = cM[2];
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        if (!ref) continue;
        const c = colNum(ref) - 1;
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
        let value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (value == null) continue;
        value = decodeXml(value);
        if (type === 's') value = shared[Number(value)] ?? value;
        else if (type !== 'str' && /^[-+]?\d+(\.\d+)?$/.test(value)) value = Number(value);
        row[c] = value;
      }
    }
    sheets.set(name, rows);
  }
  return sheets;
}

function download(event) {
  const local = join(TMP, `${event.eventKey}.xlsx`);
  if (existsSync(local)) return local;
  const url = `https://docs.google.com/spreadsheets/d/${event.spreadsheetId}/export?format=xlsx`;
  try {
    execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', url, '-o', local], {
      stdio: 'inherit',
    });
  } catch (e) {
    if (event.mayRequireLocalFile) {
      throw new Error(
        `Could not download private workbook for ${event.eventKey}. Put it at ${local} and rerun.`,
      );
    }
    throw e;
  }
  return local;
}

function sourceUrl(id) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function upsertAlias(list, matchKey, alias) {
  const old = list.find((x) => x[matchKey] === alias[matchKey]);
  if (!old) list.push(alias);
}

const athletes = new Map(existing.global.athletes.map((a) => [a.globalAthleteId, structuredClone(a)]));
const coaches = new Map(existing.global.coaches.map((c) => [c.globalCoachId, structuredClone(c)]));
const clubs = new Map(existing.global.clubs.map((c) => [c.globalClubId, structuredClone(c)]));

const athleteByKey = new Map();
for (const a of athletes.values()) athleteByKey.set(`${a.normalizedNameKey}|${a.dateOfBirth}|${a.gender}`, a.globalAthleteId);
const coachByKey = new Map();
for (const c of coaches.values()) coachByKey.set(c.normalizedNameKey, c.globalCoachId);
const clubByKey = new Map();
for (const c of clubs.values()) clubByKey.set(c.normalizedClubKey, c.globalClubId);

function ensureCoach(eventKey, rawName, eventCoachKey, sourceRow) {
  const key = normText(rawName);
  let id = coachByKey.get(key);
  if (!id) {
    id = coachIdFor(rawName);
    coachByKey.set(key, id);
    coaches.set(id, {
      globalCoachId: id,
      canonicalName: clean(rawName),
      normalizedNameKey: key,
      aliases: [],
      sourceEventCount: 0,
      eventCoachKeys: [],
    });
  }
  const coach = coaches.get(id);
  upsertAlias(coach.aliases, 'eventCoachKey', {
    eventKey,
    eventCoachKey,
    name: clean(rawName),
    rawNames: [clean(rawName)],
    sourceSheet: 'ბაზა',
    sourceRow,
  });
  if (!coach.eventCoachKeys.includes(eventCoachKey)) coach.eventCoachKeys.push(eventCoachKey);
  return id;
}

function ensureClub(eventKey, rawName, eventClubKey) {
  const key = clubNorm(rawName);
  let id = clubByKey.get(key);
  if (!id) {
    id = clubIdFor(rawName);
    clubByKey.set(key, id);
    clubs.set(id, {
      globalClubId: id,
      canonicalName: clean(rawName),
      normalizedClubKey: key,
      aliases: [],
      sourceEventCount: 0,
      eventClubKeys: [],
    });
  }
  const club = clubs.get(id);
  upsertAlias(club.aliases, 'eventClubKey', {
    eventKey,
    eventClubKey,
    name: clean(rawName),
    rawNames: [clean(rawName)],
  });
  if (!club.eventClubKeys.includes(eventClubKey)) club.eventClubKeys.push(eventClubKey);
  return id;
}

function ensureAthlete(eventKey, row) {
  const normalizedNameKey = normText(row.name);
  const globalKey = `${normalizedNameKey}|${row.dob}|${row.gender}`;
  let id = athleteByKey.get(globalKey);
  if (!id) {
    id = `athlete_${slug(normalizedNameKey)}-${row.dob}-${row.gender.toLowerCase()}_${sha8(`${normalizedNameKey}|${row.dob}|${row.gender}`)}`;
    athleteByKey.set(globalKey, id);
    athletes.set(id, {
      globalAthleteId: id,
      canonicalName: clean(row.name),
      normalizedNameKey,
      gender: row.gender,
      dateOfBirth: row.dob,
      dateOfBirthValues: [row.dob],
      aliases: [],
      eventParticipations: [],
      sourceEventCount: 0,
      sourceRowCount: 0,
      flags: [],
    });
  }
  const athlete = athletes.get(id);
  upsertAlias(athlete.aliases, 'eventAthleteKey', {
    eventKey,
    eventAthleteKey: row.eventAthleteKey,
    name: clean(row.name),
    sourceSheet: 'ბაზა',
    sourceRow: row.sourceRow,
  });
  if (!athlete.dateOfBirthValues.includes(row.dob)) athlete.dateOfBirthValues.push(row.dob);
  athlete.eventParticipations = athlete.eventParticipations.filter(
    (p) => p.eventAthleteKey !== row.eventAthleteKey,
  );
  athlete.eventParticipations.push({
    eventKey,
    eventAthleteKey: row.eventAthleteKey,
    sourceNo: row.sourceNo,
    status: row.status,
    ageAtEvent: row.ageAtEvent,
    registeredWeightCategory: row.registeredWeightCategory,
    actualWeightKg: row.actualWeightKg,
    finalAgeCategory: row.finalAgeCategory,
    finalWeightCategory: row.finalWeightCategory,
    eventDivisionKey: row.divisionKey,
    eventClubKey: row.eventClubKey,
    coachEventKeys: row.eventCoachKeys,
  });
  return id;
}

function parseMeta(rows) {
  return {
    name: clean(rows[0]?.[13]),
    place: clean(rows[3]?.[13]),
    dateText: clean(rows[4]?.[13]),
  };
}

function parseDivisions(rows, eventParticipants) {
  const regCount = new Map();
  for (const p of eventParticipants) {
    if (!p.divisionKey) continue;
    regCount.set(p.divisionKey, (regCount.get(p.divisionKey) ?? 0) + 1);
  }
  const divisions = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rawGender = r[0];
    const age = r[1];
    const rawWeight = r[2];
    if (!rawGender || !age || !rawWeight || age === 'ასაკი') continue;
    if (!['ვაჟები', 'გოგონები', 'Male', 'Female'].includes(clean(rawGender))) continue;
    const w = weightKey(rawWeight);
    if (!w) continue;
    const dKey = divisionKey(sexPrefix(rawGender), age, w);
    divisions.push({
      divisionKey: dKey,
      sourceGender: clean(rawGender),
      gender: sex(rawGender),
      ageGroupKey: clean(age),
      weightCategoryKey: w,
      weight: {
        raw: w,
        minKgExclusive: w.endsWith('_') && !w.startsWith('_') ? Number(w.replace('_', '')) : null,
        maxKgInclusive: w.startsWith('_') ? Number(w.replace('_', '')) : null,
        label: w.startsWith('_') ? `≤ ${w.replace('_', '')} kg` : `> ${w.replace('_', '')} kg`,
      },
      display: {
        gender: clean(rawGender),
        age: clean(r[5] ?? age),
        weight: clean(r[6] ?? rawWeight),
        genderKa: null,
        ageKa: clean(r[8] ?? r[5] ?? age),
        weightKa: clean(r[9] ?? r[6] ?? rawWeight),
      },
      protocolNumber: num(r[10]),
      participantCountFromProtocol: num(r[11]),
      sourceSheet: 'მონაცემები',
      sourceRow: i + 1,
      registeredAthleteCountFromBaza: regCount.get(dKey) ?? 0,
      participantCountMismatch: false,
    });
  }
  return divisions.filter((d) => d.registeredAthleteCountFromBaza || d.participantCountFromProtocol);
}

function parseParticipants(eventKey, rows) {
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = clean(r[1]);
    if (!name) continue;
    const dob = excelDate(r[7]);
    const gender = sex(r[6]);
    if (!dob) continue;
    const sourceNo = num(r[0]) ?? out.length + 1;
    const regWeight = weightKey(r[8]);
    const finalWeight = weightKey(r[13]);
    const preliminaryAge = clean(r[10]);
    const finalAge = clean(r[11]);
    const status = finalAge && finalAge !== 'არ გამოდის' && finalWeight ? 'REGISTERED' : 'NOT_COMPETING';
    const prefix = sexPrefix(r[6]);
    const dKey = status === 'REGISTERED' ? divisionKey(prefix, finalAge, finalWeight) : null;
    const clubRaw = clean(r[5] || r[3] || 'None');
    const eventClubKey = `${eventKey}:club:${slug(clubNorm(clubRaw))}-${sha8(clubNorm(clubRaw))}`;
    const globalClubId = ensureClub(eventKey, clubRaw, eventClubKey);
    const coachRaw = clean(r[2]);
    const eventCoachKeys = [];
    const globalCoachIds = [];
    for (const cn of coachNames(coachRaw)) {
      const ck = `${eventKey}:coach:${slug(normText(cn))}-${sha8(normText(cn))}`;
      eventCoachKeys.push(ck);
      globalCoachIds.push(ensureCoach(eventKey, cn, ck, i + 1));
    }
    const eventAthleteKey = `${eventKey}:athlete:${String(sourceNo).padStart(3, '0')}`;
    const actualWeightKg = num(r[12]);
    const row = {
      eventAthleteKey,
      sourceNo,
      name,
      gender,
      dob,
      status,
      sourceGender: clean(r[6]),
      sourceAreaName: clean(r[3]),
      sourceAreaSymbol: clean(r[4]),
      sourceClubName: clubRaw,
      globalClubId,
      sourceCoachNames: coachRaw,
      globalCoachIds,
      eventCoachKeys,
      eventClubKey,
      registeredWeightCategory: regWeight,
      preliminaryAgeCategory: preliminaryAge,
      finalAgeCategory: status === 'REGISTERED' ? finalAge : 'არ გამოდის',
      actualWeightKg,
      finalWeightCategory: status === 'REGISTERED' ? finalWeight : null,
      divisionKey: dKey,
      ageAtEvent: num(r[9]),
      sourceSheet: 'ბაზა',
      sourceRow: i + 1,
    };
    row.globalAthleteId = ensureAthlete(eventKey, row);
    out.push(row);
  }
  return out;
}

function parseResults(rows) {
  const byNo = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const fightNo = num(r[0]);
    if (!fightNo || !r[1] || !r[6]) continue;
    const resultText = clean(r[9]);
    let winnerSide = null;
    if (/red/i.test(resultText)) winnerSide = 'RED';
    if (/blue/i.test(resultText)) winnerSide = 'BLUE';
    if (!winnerSide) {
      const redScore = num(r[4]);
      const blueScore = num(r[5]);
      if (redScore != null && blueScore != null && redScore !== blueScore) {
        winnerSide = redScore > blueScore ? 'RED' : 'BLUE';
      }
    }
    byNo.set(fightNo, {
      winnerSide,
      redScoreRaw: r[4] ?? null,
      blueScoreRaw: r[5] ?? null,
      resultTextRaw: resultText || null,
      sourceSheet: 'ცხრილი',
      sourceRow: i + 1,
    });
  }
  return byNo;
}

function parseSchedule(eventKey, rows, results, participants) {
  const byName = new Map();
  for (const p of participants) {
    const key = normText(p.sourceName);
    const arr = byName.get(key) ?? [];
    arr.push(p);
    byName.set(key, arr);
  }
  const match = (name, age, weight, rawSex) => {
    const arr = byName.get(normText(name)) ?? [];
    const w = weightKey(weight);
    return (
      arr.find((p) => p.finalAgeCategory === age && p.finalWeightCategory === w && p.sourceGender === rawSex) ??
      arr.find((p) => p.finalAgeCategory === age && p.finalWeightCategory === w) ??
      arr[0] ??
      null
    );
  };
  const fights = [];
  const blockStarts = [0, 8, 16, 24];
  for (const start of blockStarts) {
    const roundLabel = clean(rows[0]?.[start]);
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] ?? [];
      const fightNo = num(r[start + 6]);
      const redName = clean(r[start + 1]);
      const blueName = clean(r[start + 2]);
      const age = clean(r[start + 3]);
      const w = weightKey(r[start + 4]);
      const rawSex = clean(r[start + 5]);
      if (!fightNo || !redName || !blueName || !age || !w) continue;
      const prefix = sexPrefix(rawSex);
      const red = match(redName, age, w, rawSex);
      const blue = match(blueName, age, w, rawSex);
      if (!red || !blue) continue;
      const res = results.get(fightNo) ?? {};
      const winnerGlobalAthleteId =
        res.winnerSide === 'RED' ? red.globalAthleteId : res.winnerSide === 'BLUE' ? blue.globalAthleteId : null;
      fights.push({
        eventFightKey: `${eventKey}:fight:${String(fightNo).padStart(3, '0')}`,
        eventKey,
        fightNo,
        sourceRoundLabel: roundLabel || null,
        divisionKey: divisionKey(prefix, age, w),
        gender: sex(rawSex),
        sourceGender: rawSex,
        ageGroupKey: age,
        weightCategoryKey: w,
        red: {
          sourceName: redName,
          eventAthleteKey: red.eventAthleteKey,
          globalAthleteId: red.globalAthleteId,
          area: red.sourceAreaName,
          coachRaw: red.sourceCoachNames,
          nameMatchMethod: 'normalized_name_category',
          nameMatchScore: 1,
        },
        blue: {
          sourceName: blueName,
          eventAthleteKey: blue.eventAthleteKey,
          globalAthleteId: blue.globalAthleteId,
          area: blue.sourceAreaName,
          coachRaw: blue.sourceCoachNames,
          nameMatchMethod: 'normalized_name_category',
          nameMatchScore: 1,
        },
        result: {
          winnerSide: res.winnerSide ?? null,
          winnerGlobalAthleteId,
          winnerEventAthleteKey:
            res.winnerSide === 'RED' ? red.eventAthleteKey : res.winnerSide === 'BLUE' ? blue.eventAthleteKey : null,
          redScoreRaw: res.redScoreRaw ?? null,
          blueScoreRaw: res.blueScoreRaw ?? null,
          resultTextRaw: res.resultTextRaw ?? null,
          sourceSheet: res.sourceSheet ?? 'ცხრილი',
          sourceRow: res.sourceRow ?? null,
        },
        sources: {
          scheduleSheet: 'სამატჩო განრიგი',
          scheduleSourceRow: i + 1,
          resultsSheet: res.sourceSheet ?? 'ცხრილი',
          resultsSourceRow: res.sourceRow ?? null,
        },
      });
    }
  }
  fights.sort((a, b) => a.fightNo - b.fightNo);
  return fights;
}

function buildBrackets(eventKey, divisions, participants, fights) {
  return divisions.map((d) => {
    const ids = participants
      .filter((p) => p.divisionKey === d.divisionKey)
      .map((p) => p.globalAthleteId);
    const fs = fights.filter((f) => f.divisionKey === d.divisionKey);
    return {
      eventBracketKey: `${eventKey}:bracket:${d.divisionKey}`,
      eventKey,
      divisionKey: d.divisionKey,
      protocolNumber: d.protocolNumber,
      participantGlobalAthleteIds: ids,
      participantCount: ids.length,
      fightKeys: fs.map((f) => f.eventFightKey),
      fightCount: fs.length,
      bracketTypeInferred: ids.length === 3 ? 'ROUND_ROBIN_OR_POOL' : 'ELIMINATION_OR_FINALS',
      structureConfidence: 'PARTIAL_FROM_SCHEDULE_AND_RESULTS',
      notes: 'Bracket tree/advancement slots are inferred from fights; original visual bracket layout is not fully normalized.',
    };
  });
}

function parseEvent(config) {
  const file = download(config);
  const wb = parseWorkbook(file);
  const meta = parseMeta(wb.get('მონაცემები') ?? []);
  const rawParticipants = parseParticipants(config.eventKey, wb.get('ბაზა') ?? []);
  const eventParticipants = rawParticipants.map((p) => ({
    eventAthleteKey: p.eventAthleteKey,
    globalAthleteId: p.globalAthleteId,
    sourceNo: p.sourceNo,
    sourceName: p.name,
    sourceGender: p.sourceGender,
    sourceDateOfBirth: p.dob,
    sourceAreaName: p.sourceAreaName,
    sourceAreaSymbol: p.sourceAreaSymbol,
    sourceClubName: p.sourceClubName,
    globalClubId: p.globalClubId,
    sourceCoachNames: p.sourceCoachNames,
    globalCoachIds: p.globalCoachIds,
    sourceSheet: p.sourceSheet,
    sourceRow: p.sourceRow,
    divisionKey: p.divisionKey,
  }));
  const registrations = rawParticipants.map((p) => ({
    eventRegistrationKey: `${config.eventKey}:registration:${String(p.sourceNo).padStart(3, '0')}`,
    eventKey: config.eventKey,
    eventAthleteKey: p.eventAthleteKey,
    globalAthleteId: p.globalAthleteId,
    status: p.status,
    registeredWeightCategory: p.registeredWeightCategory,
    preliminaryAgeCategory: p.preliminaryAgeCategory,
    finalAgeCategory: p.finalAgeCategory,
    actualWeightKg: p.actualWeightKg,
    finalWeightCategory: p.finalWeightCategory,
    divisionKey: p.divisionKey,
    eventClubKey: p.eventClubKey,
    globalClubId: p.globalClubId,
    eventCoachKeys: p.eventCoachKeys,
    globalCoachIds: p.globalCoachIds,
    sourceSheet: p.sourceSheet,
    sourceRow: p.sourceRow,
  }));
  const weighIns = rawParticipants
    .filter((p) => p.actualWeightKg != null)
    .map((p) => ({
      eventWeighInKey: `${config.eventKey}:weigh-in:${String(p.sourceNo).padStart(3, '0')}`,
      eventKey: config.eventKey,
      eventAthleteKey: p.eventAthleteKey,
      globalAthleteId: p.globalAthleteId,
      actualWeightKg: p.actualWeightKg,
      registeredWeightCategory: p.registeredWeightCategory,
      finalWeightCategory: p.finalWeightCategory,
      preliminaryAgeCategory: p.preliminaryAgeCategory,
      finalAgeCategory: p.finalAgeCategory,
      divisionKeyAfterWeighIn: p.divisionKey,
      statusAfterWeighIn: p.status,
      sourceSheet: p.sourceSheet,
      sourceRow: p.sourceRow,
    }));
  const divisions = parseDivisions(wb.get('მონაცემები') ?? [], rawParticipants);
  const fights = parseSchedule(
    config.eventKey,
    wb.get('სამატჩო განრიგი') ?? [],
    parseResults(wb.get('ცხრილი') ?? []),
    eventParticipants,
  );
  return {
    event: {
      name: meta.name,
      place: meta.place,
      dateText: meta.dateText,
      generatedOrReferenceDate: new Date().toISOString().slice(0, 10),
      discipline: 'SANDA',
      sourceSheet: 'მონაცემები',
      timezone: 'Asia/Tbilisi',
      eventKey: config.eventKey,
    },
    source: {
      sourceId: config.eventKey,
      sourceRole: 'primary_workbook',
      spreadsheetId: config.spreadsheetId,
      sourceUrl: sourceUrl(config.spreadsheetId),
      localFile: basename(file),
      workbookTitleFromFile: config.workbookTitle,
      sheetNames: [...wb.keys()],
    },
    summary: {
      athleteRowsExtracted: eventParticipants.length,
      registeredAthletes: registrations.filter((r) => r.status === 'REGISTERED').length,
      notCompetingRows: registrations.filter((r) => r.status !== 'REGISTERED').length,
      incompleteOrNotPlacedRows: 0,
      clubsExtracted: new Set(eventParticipants.map((p) => p.globalClubId)).size,
      coachesExtracted: new Set(eventParticipants.flatMap((p) => p.globalCoachIds)).size,
      areasExtracted: new Set(eventParticipants.map((p) => p.sourceAreaName)).size,
      divisionsExtracted: divisions.length,
      weighInsExtracted: weighIns.length,
      fightScheduleRowsExtracted: fights.length,
      teamScoresExtracted: 0,
      medalPlacementRowsExtracted: 0,
      globalAthleteLinks: eventParticipants.length,
      fightsExtractedFromScheduleOrResults: fights.length,
      fightResultsExtractedFromResultsSheet: fights.filter((f) => f.result.winnerSide).length,
      unresolvedFightAthleteRefs: 0,
      bracketsGeneratedFromDivisions: divisions.length,
    },
    divisions,
    eventParticipants,
    registrations,
    weighIns,
    brackets: buildBrackets(config.eventKey, divisions, eventParticipants, fights),
    fights,
    judgingSheetSupplementalRows: [],
    teamScores: [],
    medalPlacements: [],
    sourceOnlyOriginalCounts: {
      areas: new Set(eventParticipants.map((p) => p.sourceAreaName)).size,
      eventClubsBeforeGlobalDedupe: new Set(eventParticipants.map((p) => p.sourceClubName)).size,
      eventCoachesBeforeGlobalDedupe: new Set(eventParticipants.flatMap((p) => p.sourceCoachNames)).size,
      eventAthletesBeforeGlobalDedupe: eventParticipants.length,
    },
  };
}

const keepEvents = existing.events.filter((e) =>
  ['tbilisi_sanda_15_open_2025', 'batumi_open_sanda_2025_template_source'].includes(e.event.eventKey),
);
const newEvents = [];
for (const config of EVENTS) {
  console.log(`Reading ${config.eventKey}`);
  newEvents.push(parseEvent(config));
}

for (const c of clubs.values()) c.sourceEventCount = new Set(c.aliases.map((a) => a.eventKey)).size;
for (const c of coaches.values()) c.sourceEventCount = new Set(c.aliases.map((a) => a.eventKey)).size;
for (const a of athletes.values()) {
  a.sourceEventCount = new Set(a.aliases.map((x) => x.eventKey)).size;
  a.sourceRowCount = a.aliases.length;
}

const allEvents = [...keepEvents, ...newEvents];
const out = {
  ...existing,
  schema: existing.schema ?? 'wushu_sanda_global_deduped_import',
  createdAt: new Date().toISOString(),
  createdFor: existing.createdFor ?? 'geo_wushu_real',
  purpose: 'Raw deduped workbook export generated from Google Drive Sanda workbooks.',
  sources: allEvents.map((e) => e.source),
  globalSummary: {
    sourceWorkbookCount: allEvents.length,
    sourceEventAthleteRows: allEvents.reduce((n, e) => n + e.eventParticipants.length, 0),
    globalAthletesAfterDedupe: athletes.size,
    globalCoachesAfterDedupe: coaches.size,
    globalClubsAfterDedupe: clubs.size,
    eventRegistrationRowsIncludingNotCompeting: allEvents.reduce((n, e) => n + e.registrations.length, 0),
    activeRegistrationRows: allEvents.reduce((n, e) => n + e.registrations.filter((r) => r.status === 'REGISTERED').length, 0),
    notCompetingRegistrationRows: allEvents.reduce((n, e) => n + e.registrations.filter((r) => r.status !== 'REGISTERED').length, 0),
    eventWeighIns: allEvents.reduce((n, e) => n + e.weighIns.length, 0),
    eventDivisions: allEvents.reduce((n, e) => n + e.divisions.length, 0),
    eventBrackets: allEvents.reduce((n, e) => n + e.brackets.length, 0),
    eventFights: allEvents.reduce((n, e) => n + e.fights.length, 0),
    eventFightResults: allEvents.reduce((n, e) => n + e.fights.filter((f) => f.result?.winnerSide).length, 0),
    medalPlacementRows: allEvents.reduce((n, e) => n + (e.medalPlacements?.length ?? 0), 0),
    teamScoreRows: allEvents.reduce((n, e) => n + (e.teamScores?.length ?? 0), 0),
    autoMergedAthleteSourceRows: null,
    athleteDuplicateReviewCandidates: null,
  },
  global: {
    athletes: [...athletes.values()].sort((a, b) => a.globalAthleteId.localeCompare(b.globalAthleteId)),
    coaches: [...coaches.values()].sort((a, b) => a.globalCoachId.localeCompare(b.globalCoachId)),
    clubs: [...clubs.values()].sort((a, b) => a.globalClubId.localeCompare(b.globalClubId)),
  },
  events: allEvents,
  recommendedImportOrder: allEvents.map((e) => e.event.eventKey),
};

writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Wrote ${OUT}`);
for (const e of out.events) {
  console.log(`${e.event.eventKey}: ${e.eventParticipants.length} participants, ${e.fights.length} fights`);
}
