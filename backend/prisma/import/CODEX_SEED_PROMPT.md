# Prompt — Seed real Wushu event data into `geo_wushu_real`

> Paste this whole file into Codex (or any coding agent) as the task prompt.
> It is self-contained: it teaches you how to **read** the real source data and
> how to **seed** it into the database, plus the non-obvious gotchas that will
> bite you if you skip them.

---

## 0. Your job

Load **every real** Georgian Wushu Federation event from **2024, 2025 and 2026**
(athletes, clubs, federations, registrations, weigh-ins, brackets, fights,
results) into the local Postgres database `geo_wushu_real`, using the import
pipeline in `backend/prisma/import/`.

Only two 2025 events are captured so far (in `source-export.json`). **You must
read the Google Drive workbooks for the remaining events and add them**, then
re-run the pipeline so the DB holds all three years. The full Drive folder map
and the per-event reading procedure are in §3.

Work from the repo root `/Users/sn/Wushu`. Backend lives in `backend/`.

### Definition of done
- Every competition event found under the 2024 / 2025 / 2026 Drive folders (§3b)
  is present in `source-export.json` and seeded into `geo_wushu_real`.
- `node prisma/import/validate-seed.mjs` reports **0 errors**.
- The verification queries in §6 list all the expected events with non-zero
  registrations, and federations/clubs follow the rules in §5.
- You report a per-event table: event name, dates, location, #athletes, #fights.

---

## 1. The data model you are populating (read this first)

Hierarchy: **Country → City → Federation → Club → Coach / Athlete.**

- A **Club** optionally belongs to a **Federation** (`Club.federationId` is
  nullable). **Most clubs are independent** (no federation). Both `Club` and
  `Federation` have `isOfficial Boolean @default(true)`.
- An **Event** has `accessType EventAccessType @default(OPEN)` (OPEN = any club
  may register; CLOSED = official clubs only).
- An **Athlete** reaches a federation only *through its club* — there is no
  direct athlete→federation link.
- Schema is `backend/prisma/schema.prisma`. Migrations are in
  `backend/prisma/migrations/` and are the source of truth for DDL.

---

## 2. The pipeline (files in `backend/prisma/import/`)

| File | Role |
|---|---|
| `source-export.json` | **Raw** deduped workbook export. Input. **Do not hand-edit.** |
| `transliterate.mjs` | Georgian ⇄ Latin name helpers |
| `build-seed.mjs` | Transforms `source-export.json` → `wushu-seed.json` (curated names, geography, federations, categories) |
| `wushu-seed.json` | Clean, schema-shaped seed (generated — never edit by hand) |
| `validate-seed.mjs` | Referential-integrity / constraint checks on `wushu-seed.json` |
| `seed-import.ts` | Loads `wushu-seed.json` into the DB (idempotent per event slug) |
| `verify-medals.ts` | Runs the app's own results logic over the seeded DB |
| `id-extracted.json` | OCR'd national IDs → used as `documentId` where available |
| `README.md` | Human notes + data decisions |

Flow: `source-export.json → build-seed.mjs → wushu-seed.json → seed-import.ts → DB`.
All curation (names, region inference, federation rules, category template) lives
in **`build-seed.mjs`** — that's the file you edit, never the generated JSON.

---

## 3. How to READ the source data

### 3a. The offline path (preferred, fully reproducible)
Everything for the two 2025 events is already in `source-export.json`. You do
**not** need Google Drive to re-seed them — just run the pipeline (§4).

### 3b. The Google Drive sheets — read ALL events from here
You need a Google Drive MCP (tools like `search_files` / `read_file_content`). If
it is not connected, STOP and ask the user to connect it — you cannot get 2024 /
2026 without it.

`read_file_content` returns a sheet as markdown tables. Large sheets exceed the
token limit — when that happens the tool **saves the JSON to a file**; probe it
with `jq 'type, length'` then slice with `python3`/`jq`. Never read a 70k-char
dump whole.

#### Drive folder map (verified)
Events are organised in **year folders**, each containing one **subfolder per
event**. Enumerate children with `search_files` query `parentId = '<id>'`.

```
2024  folder 1L2mb6vXtmd1qkIN-AQVflevvNeOLOb7W
2025  folder 1Xm3gj8VC-fBuO29OgZ64Rg8fMHqmphhn
2026  folder 1aV83pzomTK88QdI6RgFnEOG5G5nY2jD2
```

Event subfolders found at the time of writing (re-list to catch new ones):

| Year | Event folder (KA → meaning) | Folder ID |
|---|---|---|
| 2024 | თბილისის ღია 14 პირველობა (Tbilisi 14th Open) | `1oqBVB7AWEkFDOgswBUwo0lUstC24s2Ji` |
| 2024 | საქართველოს მე-8 თასის გათამაშება (Georgia 8th Cup) | `173Q-XuCD-eMwleTuDh-ratGxoU3IN_mN` |
| 2024 | ანანური (Ananuri) | `1RwxBCuag6rRwDb9aC9Jyt4zKpFNb7zwT` |
| 2024 | ქობულეთის ზაფხულის შეკრება (Kobuleti summer camp) | `195fYIvO-Qzlw35FgNWJ2y5h1_gUeos8F` |
| 2024 | ბათუმი და პროფ (Batumi + Pro, Oct 2024) | `1EDPXd4kjytozo6_qSImmxDoqUmbDV9r5` |
| 2024 | საქართველოს ჩემპიონატი (Georgia Championship) | `1KKysh-CrebdHNdJZqOYziczINrC_zr3Q` |
| 2024 | წესები (rules — NOT an event) | `1DgfKjyx5ymPIUIWzYXtYxE8HiOEZfQI7` |
| 2025 | თბილისის ღია პირველობა (Tbilisi 15th Open) | `1Rjo3SUTsmn1eLbS2YQDQAIYiZ-UgsFrm` |
| 2025 | Batumi (Batumi Open, Aug 2025) | `19O3SW12h_QGppaoBnd0Eo2bxlwBS-8qX` |
| 2025 | Kutaisi | `1fKoVFI6sGHiPyI6BkBoQsHlND8LfKv5r` |
| 2025 | საქართველოს თასი (Georgia Cup) | `1_gqfGCOiskMWo2kUulBEMn-QA1aKPGx5` |
| 2025 | საქართველოს ჩემპიონატი (Georgia Championship) | `10C-DjFTxCy-O6LZ1xNx_w4Gkc1qScOYR` |
| 2025 | Eurasian Professional Sanda League 2025 | `1QQ7HrkM2aoS1shdMLNfxbRNzNfKLvWP_` |
| 2025 | For Share (shared exports — check, may not be an event) | `1dzCJx901B3ejTPXmAZkMJKG2ksUypKrk` |
| 2026 | თბილისი (Tbilisi) | `16SbIwBEuYCSlyI_8YOvkRRsT2-e2lIgB` |

Known workbooks already located (each event folder also has its own — list them):

| File | Drive file ID | Event |
|---|---|---|
| Registration Form (Responses) | `1JgcudqVtnDbKjCTThhzFjwTrXJbeMWvD_oyo_Za1QIU` | Batumi 2025 raw registrations |
| Sanda | `1-ZjGTUF5aund2oMYSqSJK49ljvBBVlMU0ZILUmyNSGw` | Batumi 2025 workbook |
| Sanda | `1LsRWV7EoshXAMy_jeRRNHBBOzNcHzywvik0wSwh1QIs` | Oct 2024 Batumi+Pro master |
| ტურნირი სანდა | `1RWOxiXKlUYqOFyCbwUa_QpD0tjDytJ3PNEiDmq5PgEs` | 2026 Tbilisi (Region+Club cols) |
| ტურნირი სანდა | `19UG_y2z31cSGsXJym9RGeQXmR3WYGI7fGHZ9hZLcmM0` | Georgia Championship workbook |
| კატეგორიები | `1QiCCI_GqlGuHyI5kdL2ZJ-Csg6APijQK-9SM2NRm2xI` | category definitions |

#### Per-event procedure (do this for EVERY event folder)
1. `search_files` with `parentId = '<eventFolderId>'` to list its files.
2. The participant data is the spreadsheet whose tabs hold a roster (look for a
   "Sanda" / "ტურნირი სანდა" / "Registration" workbook, or the richest sheet).
   Skip pure rules/contracts/ID-scan/photo folders.
3. Read that workbook; map ITS columns explicitly (layouts differ — see gotchas).
   Pull: athlete name (EN/KA), coach, country, club/region, sex, DOB, weight
   category, and results/brackets if the workbook has a protocol/fights tab.
4. Derive event metadata: name (EN+KA), location, dates (the workbook usually
   states "Place / Date", e.g. "Batumi, Georgia — October 17-22, 2024"), and a
   kebab-case `slug`.
5. Normalize into the `source-export.json` shape (an `events[]` entry plus the
   global athletes/clubs/coaches it references — match the existing two events'
   structure exactly). Reconcile athletes/clubs/coaches **across events** by the
   same dedupe keys already used (coach is the stable join; see gotcha 3).
6. If unsure whether a folder is a real competition (camps like Kobuleti/Ananuri
   may be training gatherings, not tournaments), ask the user before importing.

### ⚠️ Critical reading gotchas (these are why the data was wrong before)
1. **There is NO "Federation" column in any sheet.** Each sheet has a single
   flat **"Club"** (`კლუბი`) field that *mixes* real clubs (Barlas, Aieti-2017,
   Chkhondidi…) with federation names (Tbilisi Wushu Federation, Kutaisi Wushu
   Federation, Uzbekistan Wushu Federation, Traditional WF of Armenia). The
   club→federation hierarchy is **not in the data** — do not invent one.
2. **Columns differ per event.** 2024 master puts **city names** in the "club"
   column (Tbilisi, Martvili, Kutaisi…). The 2025 form puts club/fed **names**.
   The 2026 sheet has **separate `რეგიონი` (region) + `კლუბი` (club)** columns
   plus a country code in `სიმბოლო`/symbol (თბი, ქუთ, ამბ, ირმ…). Map each
   event's columns explicitly; never assume a fixed layout.
3. **The coach is the stable entity** across events; the same coach's "club"
   string changes year to year (e.g. Data Tsulaia = "Martvili"/2024 ≈
   "ჭყონდიდი"/2025-26). Use the coach to reconcile clubs across events.
4. **No document IDs in the sheets.** IDs were OCR'd from uploaded ID scans into
   `id-extracted.json`; `build-seed.mjs` prefers a real 11-digit Georgian ID and
   falls back to a stable synthetic `IMPORT-<hash>`. Keep it reproducible.
5. **Names are bilingual.** Where a sheet gives only one script, the other is
   transliterated via `transliterate.mjs`. Foreign names are phonetic.

---

## 4. How to SEED the DB

Postgres runs in Docker (container `wushu-db-1`, image postgres:16). The app's
backend uses `geo_wushu_real`.

```bash
# 0. Ensure DB is up
docker compose up -d db

cd backend
export DATABASE_URL="postgresql://geo:geo123@localhost:5432/geo_wushu_real"

# 1. (Re)generate + validate the seed from source
node prisma/import/build-seed.mjs        # source-export.json -> wushu-seed.json
node prisma/import/validate-seed.mjs      # MUST report "0 error(s)"

# 2a. FRESH database (wipe + reload) — the import is built for a fresh DB:
docker exec wushu-db-1 psql -U geo -d geo_wushu_real \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npx prisma migrate deploy                 # applies ALL migrations
npx ts-node prisma/import/seed-import.ts  # loads the events

# 2b. ADDITIVE (DB already seeded): seed-import.ts skips an event whose slug
#     already exists, so re-running only adds NEW events. Existing geography/
#     clubs are NOT diffed — if you changed them, use the fresh path (2a).

# 3. (optional) prove medals/results compute from the imported fights
npx ts-node prisma/import/verify-medals.ts
```

> ⚠️ `DROP SCHEMA public CASCADE` **erases all of `geo_wushu_real`.** It is safe
> here *only because this DB is 100% reproducible from the pipeline* (no
> hand-entered data). Confirm with the user before running it.

Do **not** run `prisma migrate reset` (Prisma 7.8 has no `--skip-seed`, and its
auto-seed `prisma/seed.ts` runs the category-template seed the import replaces).
Do **not** run `prisma/seed-category-templates.ts` — the import builds its own
category template from the events.

---

## 5. Data decisions you MUST preserve (in `build-seed.mjs`)

- **Federations:** only the four real ones become `Federation` rows —
  `REAL_FEDERATIONS` (Tbilisi, Kutaisi, Uzbekistan, Traditional WF of Armenia).
  Each of the four federation-named source "clubs" (`FEDERATION_TEAM_CLUBS`)
  becomes a same-named **"… Team" club nested under its federation** (holds the
  athletes that registered directly under the federation). **Every other club is
  independent** (`federationKey = null`). Never auto-create a per-city federation.
- **documentId:** real OCR'd ID if present in `id-extracted.json`, else
  `IMPORT-<hash>` (stable across rebuilds).
- **Geography:** country from the area/symbol column; Georgian municipalities
  from the area column; foreign clubs use their country as a single city.
- **Categories:** built from the events' divisions; `Registration.categoryCode`
  is the human weight label ("≤ 65 kg"), `Bracket`/`Fight.categoryCode` use the
  native `AGE_DIV_WEIGHT_id` format.
- **Bracket format** from athlete count: ≤2 direct-final, 3 round-robin, 4+
  single-elim. Medals are **app-derived** from confirmed fights, not stored.

When adding a NEW event: add its normalized rows into `source-export.json`'s
shape (events[].athletes/clubs/coaches/fights), wire any new club/coach
name overrides in `build-seed.mjs`, then re-run §4. Keep new federation-named
entries out of `FEDERATION_TEAM_CLUBS` unless they are genuinely federations.

---

## 6. Verify it worked

```bash
# every event with its participant + fight counts (expect all 2024/25/26 events)
docker exec wushu-db-1 psql -U geo -d geo_wushu_real -c \
"SELECT e.name, e.\"competitionStartDate\"::date AS start, e.location,
        (SELECT COUNT(*) FROM \"Registration\" r WHERE r.\"eventId\"=e.id) regs,
        (SELECT COUNT(*) FROM \"Fight\" f WHERE f.\"eventId\"=e.id) fights
 FROM \"Event\" e ORDER BY start;"

# federation/club hierarchy spot-check (rules from §5)
docker exec wushu-db-1 psql -U geo -d geo_wushu_real -c \
"SELECT c.name city, COALESCE(f.name,'(independent)') federation, cl.name club
 FROM \"Club\" cl JOIN \"City\" c ON c.id=cl.\"cityId\"
 LEFT JOIN \"Federation\" f ON f.id=cl.\"federationId\" ORDER BY 2,1;"
```

Expected: one `Event` row per real 2024/2025/2026 competition, each with
non-zero registrations; federations limited to genuinely-federation entries with
their "… Team" club, all other clubs independent (§5). Cross-check the event
count and dates against the Drive folder map (§3b).

---

## 7. After seeding — tell the user to do these (they bite every time)

1. **Restart the backend** (`npm run dev:backend`). Prisma client was
   regenerated; `nest --watch` will **not** hot-reload `@prisma/client`, so the
   running server throws on new fields until restarted.
2. **Log in again.** A fresh seed recreates all users with new IDs, invalidating
   the current session. Admin: `admin@georgian-wushu-federation.ge` /
   `ChangeMe123!`. Coaches: `<name>@coach.gwf.ge` / `CoachPass123!`.
3. **Don't reuse old browser URLs** — event IDs (cuid) change on every reseed;
   stale `/admin/events/<oldId>/…` links 404. Navigate fresh from `/admin`.

---

## 8. Guardrails
- Never hand-edit `wushu-seed.json` (regenerated) or `source-export.json`
  curation logic that belongs in `build-seed.mjs`.
- `validate-seed.mjs` must print **0 errors** before importing.
- Confirm before any destructive DB command.
- Keep all athlete/club/event names bilingual (EN + KA).
