// ──────────────────────────────────────────────────────────────────────────
// Per-run namespacing.
//
// The suite must be idempotently re-runnable WITHOUT a DB reset: athletes carry
// a `@@unique([organisationId, documentId])` constraint, so any two runs that
// minted the same documentId would collide with DOCUMENT_ID_ALREADY_EXISTS.
// Everything generated here therefore embeds a per-run id so re-running never
// collides on prior data.
//
// RUN_ID is computed ONCE at module load. The whole pipeline lives in a single
// serial spec file in a single worker, so this value is stable for the entire
// run and shared across every phase.
// ──────────────────────────────────────────────────────────────────────────

// Short, URL/slug-safe, lexically increasing run id (base36 of the epoch ms).
export const RUN_ID = Date.now().toString(36);

// A numeric tail used to build run-unique 11-digit Georgian national IDs.
// Date.now() % 1e9 gives a 9-digit-ish number; we pad/prefix to a stable 11.
const RUN_NUM = Date.now() % 1_000_000_000; // up to 9 digits

// Human-facing run label, handy in names so a reviewer can eyeball which run a
// row belongs to.
export const RUN_LABEL = `R${RUN_ID}`;

/** Athlete documentId (international/passport style): `E2E<runId><seq>`. */
export function athleteDocId(seq: number): string {
  return `E2E${RUN_ID}${seq}`;
}

/**
 * A run-unique 11-digit string (`/^\d{11}$/`) for a Georgian-coach national id.
 * Built from the run's epoch tail + a 2-digit sequence so multiple GE coaches
 * in one run stay distinct, and different runs never collide.
 */
export function geNationalId(seq: number): string {
  const tail = String(RUN_NUM).padStart(9, '0').slice(-9);
  const head = String(seq % 100).padStart(2, '0');
  return `${head}${tail}`.slice(0, 11).padStart(11, '0');
}

/** Namespaced display name, e.g. `nm("Country") → "Country R<run>"`. */
export function nm(base: string): string {
  return `${base} ${RUN_LABEL}`;
}

/** Namespaced slug, e.g. `slugify("wushu-cup") → "wushu-cup-r<run>"`. */
export function slugify(base: string): string {
  return `${base}-${RUN_ID}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
