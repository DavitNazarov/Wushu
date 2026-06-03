-- DB-1: add missing indexes.
--   * AuditLog grew one row per mutation and was COMPLETELY unindexed — every
--     tenant-filtered audit read table-scanned.
--   * Several org-scoped FK columns were unindexed (Postgres does NOT auto-index
--     foreign keys): Club, DocumentLink, ContactSubmission, AthleteMerge,
--     TimerState.
--   * TimerState.state is scanned every second by the timer-automation cron.
-- BF-15 / DB-9: prevent two concurrent weigh-in attempts from sharing attemptNo.
--
-- Index names follow Prisma's "<Table>_<cols>_idx" / "_key" convention so the
-- schema stays drift-free. IF NOT EXISTS keeps this safe to re-run (matches the
-- repo's existing idempotent-migration style).

-- AuditLog ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_eventId_createdAt_idx" ON "AuditLog"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- Unindexed FK columns ------------------------------------------------------
CREATE INDEX IF NOT EXISTS "Club_organisationId_idx" ON "Club"("organisationId");
CREATE INDEX IF NOT EXISTS "DocumentLink_organisationId_idx" ON "DocumentLink"("organisationId");
CREATE INDEX IF NOT EXISTS "ContactSubmission_organisationId_idx" ON "ContactSubmission"("organisationId");
CREATE INDEX IF NOT EXISTS "AthleteMerge_organisationId_idx" ON "AthleteMerge"("organisationId");
CREATE INDEX IF NOT EXISTS "TimerState_organisationId_idx" ON "TimerState"("organisationId");

-- TimerState.state scan (1s automation cron) --------------------------------
CREATE INDEX IF NOT EXISTS "TimerState_organisationId_state_idx" ON "TimerState"("organisationId", "state");

-- BF-15 / DB-9: weigh-in attempt uniqueness ---------------------------------
-- A prior race (pre-BF-15) could have left two attempts sharing the same
-- (registrationId, attemptNo). The UNIQUE INDEX below would then FAIL to create
-- and abort the whole deploy. So first renumber every registration's attempts to
-- a gap-free 1..N sequence — ordered by the existing attemptNo, then createdAt,
-- then id — touching only rows whose number actually changes. No data is
-- deleted. Idempotent: on already-sequential data this updates zero rows, so it
-- is safe to re-run and a no-op on a clean DB.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "registrationId"
      ORDER BY "attemptNo", "createdAt", "id"
    ) AS rn
  FROM "WeighInAttempt"
)
UPDATE "WeighInAttempt" w
SET "attemptNo" = ranked.rn
FROM ranked
WHERE w."id" = ranked."id"
  AND w."attemptNo" <> ranked.rn;

CREATE UNIQUE INDEX IF NOT EXISTS "WeighInAttempt_registrationId_attemptNo_key" ON "WeighInAttempt"("registrationId", "attemptNo");
