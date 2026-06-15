-- Drop old generic date columns
ALTER TABLE "Event" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "endDate";

-- Add structured date fields (NOT NULL with a safe default for existing rows).
-- IF NOT EXISTS makes this migration idempotent: this folder was renamed from
-- "20260304_add_event_date_fields" to fix replay order (it must run BEFORE
-- 20260304090401_add_tournament_models, which does ALTER COLUMN
-- "registrationStartDate" DROP DEFAULT). The custom migrate-deploy keys on
-- migration_name, so databases that already applied the old name re-run this
-- under the new name — these guards make that re-run a no-op.
ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "timezone"              TEXT         NOT NULL DEFAULT 'Asia/Tbilisi',
  ADD COLUMN IF NOT EXISTS "registrationStartDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "registrationEndDate"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "weighInStartDate"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "weighInEndDate"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "competitionStartDate"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "competitionEndDate"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "dates"                 JSONB;

-- Drop old global unique on slug, replace with per-organisation unique
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_slug_key";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_organisationId_slug_key'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_organisationId_slug_key" UNIQUE ("organisationId", "slug");
  END IF;
END $$;
