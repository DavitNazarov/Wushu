// Validates wushu-seed.json for referential integrity + schema constraints
// before it is ever sent to the database. Run after build-seed.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(HERE, 'wushu-seed.json'), 'utf8'));

const errors = [];
const err = (m) => errors.push(m);

const countryCodes = new Set(data.countries.map((c) => c.code));
const cityKeys = new Set(data.cities.map((r) => r.key));
const federationKeys = new Set((data.federations ?? []).map((f) => f.key));
const clubKeys = new Set(data.clubs.map((c) => c.key));
const coachKeys = new Set((data.coaches ?? []).map((c) => c.key));
const athleteKeys = new Set(data.athletes.map((a) => a.key));
const catKeys = new Set();
for (const g of data.categoryTemplate.ageGroups)
  for (const w of g.weights) catKeys.add(`${g.sex}|${g.ageGroupKey}|${w.weightKey}`);

// --- cities ---
for (const r of data.cities) {
  if (!countryCodes.has(r.countryCode)) err(`city ${r.key}: country ${r.countryCode} not declared`);
}

// --- federations ---
for (const f of data.federations ?? []) {
  if (!cityKeys.has(f.cityKey)) err(`federation ${f.key}: city ${f.cityKey} not declared`);
}

// --- clubs ---
for (const c of data.clubs) {
  if (!c.name) err(`club ${c.key}: empty name`);
  if (!countryCodes.has(c.countryCode)) err(`club ${c.key}: country ${c.countryCode} not declared`);
  if (!cityKeys.has(c.cityKey)) err(`club ${c.key}: city ${c.cityKey} not declared`);
  if (c.federationKey && !federationKeys.has(c.federationKey)) err(`club ${c.key}: federation ${c.federationKey} not declared`);
}

// --- coaches ---
const coachEmails = new Set();
for (const co of data.coaches ?? []) {
  if (!co.displayName) err(`coach ${co.key}: empty displayName`);
  if (!/^[^@\s]+@[^@\s]+$/.test(co.email || '')) err(`coach ${co.key}: bad email ${co.email}`);
  if (coachEmails.has(co.email)) err(`coach ${co.key}: duplicate email ${co.email}`);
  coachEmails.add(co.email);
  if (co.clubKey && !clubKeys.has(co.clubKey)) err(`coach ${co.key}: club ${co.clubKey} missing`);
  if (!cityKeys.has(co.cityKey)) err(`coach ${co.key}: city ${co.cityKey} not declared`);
  if (!countryCodes.has(co.countryCode)) err(`coach ${co.key}: country ${co.countryCode} missing`);
}

// --- athletes ---
const docIds = new Set();
for (const a of data.athletes) {
  if (!a.firstName) err(`athlete ${a.key}: empty firstName`);
  if (a.lastName == null) err(`athlete ${a.key}: null lastName`);
  if (!a.firstNameKa) err(`athlete ${a.key}: empty firstNameKa`);
  if (!['MALE', 'FEMALE'].includes(a.sex)) err(`athlete ${a.key}: bad sex ${a.sex}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dateOfBirth || '')) err(`athlete ${a.key}: bad dob ${a.dateOfBirth}`);
  if (!countryCodes.has(a.countryCode)) err(`athlete ${a.key}: country ${a.countryCode} missing`);
  if (!cityKeys.has(a.cityKey)) err(`athlete ${a.key}: city ${a.cityKey} not declared`);
  if (a.clubKey && !clubKeys.has(a.clubKey)) err(`athlete ${a.key}: club ${a.clubKey} missing`);
  for (const ck of a.coachKeys ?? []) {
    if (!coachKeys.has(ck)) err(`athlete ${a.key}: coach ${ck} missing`);
  }
  if (docIds.has(a.documentId)) err(`athlete ${a.key}: duplicate documentId ${a.documentId}`);
  docIds.add(a.documentId);
}

// --- events ---
for (const ev of data.events) {
  const seenReg = new Set();
  for (const r of ev.registrations) {
    if (!athleteKeys.has(r.athleteKey)) err(`${ev.key} reg: athlete ${r.athleteKey} missing`);
    if (r.clubKey && !clubKeys.has(r.clubKey)) err(`${ev.key} reg: club ${r.clubKey} missing`);
    if (seenReg.has(r.athleteKey)) err(`${ev.key} reg: duplicate athlete ${r.athleteKey} (violates @@unique[event,athlete])`);
    seenReg.add(r.athleteKey);
    if (r.finalCategoryKey && !catKeys.has(r.finalCategoryKey)) err(`${ev.key} reg: finalCat ${r.finalCategoryKey} missing`);
    if (r.registeredCategoryKey && !catKeys.has(r.registeredCategoryKey)) err(`${ev.key} reg: regCat ${r.registeredCategoryKey} missing`);
    if (!['APPROVED', 'WITHDRAWN', 'PENDING', 'SUBMITTED', 'REJECTED'].includes(r.status)) err(`${ev.key} reg: bad status ${r.status}`);
  }
  for (const w of ev.weighIns) {
    if (!athleteKeys.has(w.athleteKey)) err(`${ev.key} weighIn: athlete ${w.athleteKey} missing`);
    if (typeof w.weightKg !== 'number') err(`${ev.key} weighIn: bad weight`);
  }
  for (const f of ev.fights) {
    if (!catKeys.has(f.categoryKey)) err(`${ev.key} fight: cat ${f.categoryKey} missing`);
    if (!athleteKeys.has(f.redAthleteKey)) err(`${ev.key} fight: red ${f.redAthleteKey} missing`);
    if (f.isBye) {
      // Bye: exactly one side filled, winner = the lone (red) athlete.
      if (f.blueAthleteKey != null) err(`${ev.key} bye fight: blue must be null`);
      if (f.winnerAthleteKey !== f.redAthleteKey) err(`${ev.key} bye fight: winner must be the lone athlete`);
    } else {
      if (!athleteKeys.has(f.blueAthleteKey)) err(`${ev.key} fight: blue ${f.blueAthleteKey} missing`);
      if (f.redAthleteKey === f.blueAthleteKey) err(`${ev.key} fight: red==blue ${f.redAthleteKey}`);
      if (f.winnerAthleteKey && ![f.redAthleteKey, f.blueAthleteKey].includes(f.winnerAthleteKey))
        err(`${ev.key} fight: winner not a participant`);
    }
  }
}

console.log(`Validation: ${errors.length} error(s).`);
for (const e of errors.slice(0, 60)) console.log('  ✗', e);
if (errors.length > 60) console.log(`  ... and ${errors.length - 60} more`);
if (errors.length === 0) console.log('  ✓ referential integrity, doc-id uniqueness, enums, and constraints all pass.');
process.exitCode = errors.length ? 1 : 0;
