# Real-event import (2025 Sanda)

Turns the two 2025 Sanda workbook exports into a real, deployable database:

- **Tbilisi 15th Wushu Open Championship** (31 Jan – 2 Feb 2025)
- **Batumi Open International Wushu Tournament** (1 – 6 Aug 2025)

Both are imported as `COMPLETED`, published events with full results.

## Files

| File | What it is |
|---|---|
| `source-export.json` | Raw deduped workbook export (input — do not edit) |
| `transliterate.mjs` | Georgian ⇄ Latin name transliteration helpers |
| `build-seed.mjs` | Transforms `source-export.json` → `wushu-seed.json` |
| `wushu-seed.json` | Clean, schema-shaped seed data (generated) |
| `validate-seed.mjs` | Referential-integrity / constraint checks on `wushu-seed.json` |
| `seed-import.ts` | Loads `wushu-seed.json` into the database |
| `verify-medals.ts` | Runs the app's own results logic over the seeded DB |

## Run

```bash
cd backend
export DATABASE_URL="postgresql://geo:geo123@localhost:5432/geo_wushu_real"

node prisma/import/build-seed.mjs          # source-export.json -> wushu-seed.json
node prisma/import/validate-seed.mjs       # must report 0 errors

npx prisma migrate deploy                  # schema
npx ts-node prisma/import/seed-import.ts   # the two events (self-contained)

npx ts-node prisma/import/verify-medals.ts # optional: prove medals compute
```

> Do **not** run `prisma/seed-category-templates.ts` — that seeds the global
> `SYSTEM_BUILT_IN` template + default option library. This import builds the
> Category Options + Template purely from these two events instead.

`seed-import.ts` skips an event whose slug already exists, so re-runs are safe.
Logins are configurable via env (defaults shown):
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (`admin@georgian-wushu-federation.ge` / `ChangeMe123!`),
`SEED_COACH_PASSWORD` (`CoachPass123!`).

## Data decisions (because the source lacked them)

- **Document IDs** — the workbooks have no ID field, but the registration forms
  link passport/ID **scans**. Those were OCR'd (`id-extracted.json`, built via
  `ocr-merge.mjs`): **86 real 11-digit Georgian national IDs** were recovered and
  are used as `documentId`; the remaining 94 athletes (no upload, HEIC/PDF the
  OCR couldn't read, mismatched uploads, or foreign teams that uploaded nothing)
  keep a stable synthetic `IMPORT-<hash>`. `build-seed.mjs` reads
  `id-extracted.json` and prefers the real ID, so rebuilds are reproducible.
- **Names** — every athlete/club is bilingual. Where the two events supplied the
  name in both scripts it is used verbatim; the missing side is transliterated.
  Four Indian athletes are mononyms (empty last name). Transliterations of
  foreign (non-Georgian) names are phonetic approximations.
- **DOBs** — six athletes had a null DOB in the dedup; all recovered from the
  per-event source rows (Georgian/Tbilisi row preferred on disagreement).
- **Geography** — country from source area; **real Georgian regions**
  (municipalities: Tbilisi, Kutaisi, Martvili, Marneuli, Tsalka, Dusheti,
  Dedoplistskaro, Ambrolauri, Bolnisi) taken from the Tbilisi sheet's area
  column, with each club's region inferred from its athletes (or by name for
  Batumi-only clubs). Foreign clubs use their country as a single region.
- **Coaches** — each of the 23 coaches becomes a `User(role=coach)` attached to
  their club, with a transliterated synthetic email (`<name>@coach.gwf.ge`) and
  a shared default password. (Schema has no athlete→coach link, so they aren't
  tied to specific athletes.)
- **Categories** — the Category Options library + the org Category Template are
  built from these events' divisions. `Registration.categoryCode` is the
  human weight name ("≤ 65 kg"); `Bracket`/`Fight.categoryCode` use the app's
  native `AGE_DIV_WEIGHT_id` format — no raw `SEX|AGE|WEIGHT` keys in the UI.
- **Clubs** — a junk "None" club was dropped; two duplicate pairs merged; all 19
  given curated bilingual names.
- **Federations** — the source sheets carry no club→federation hierarchy (the
  single "Club" column mixes real clubs with federation names), so we do **not**
  invent one per city. Only the four entries that are literally federations
  (Tbilisi, Kutaisi, Uzbekistan, Armenia Traditional) become `Federation` rows;
  each also gets a same-named "… Team" club nested under it for the athletes that
  registered directly under the federation. **Every other club is independent**
  (`federationId = null`). See `FEDERATION_TEAM_CLUBS` / `REAL_FEDERATIONS` in
  `build-seed.mjs`.
- **Brackets** — `format` from athlete count (≤2 direct final / 3 round-robin /
  4+ single-elim). The source stores schedule rounds, not bracket rounds, so for
  single-elim the bracket round is **reconstructed from the win/loss graph** so
  the final is a single fight and medals resolve correctly.
- **Medals/team scores** from the workbook are NOT stored — the app derives them
  from the confirmed fights, which are imported.
