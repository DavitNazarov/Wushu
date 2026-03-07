-- Drop old generic date columns
ALTER TABLE "Event" DROP COLUMN IF EXISTS "startDate";
ALTER TABLE "Event" DROP COLUMN IF EXISTS "endDate";

-- Add structured date fields (NOT NULL with a safe default for existing rows)
ALTER TABLE "Event"
  ADD COLUMN "timezone"             TEXT        NOT NULL DEFAULT 'Asia/Tbilisi',
  ADD COLUMN "registrationStartDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN "registrationEndDate"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN "weighInStartDate"      TIMESTAMP(3),
  ADD COLUMN "weighInEndDate"        TIMESTAMP(3),
  ADD COLUMN "competitionStartDate"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN "competitionEndDate"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  ADD COLUMN "dates"                 JSONB;

-- Drop old global unique on slug, replace with per-organisation unique
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_slug_key";
ALTER TABLE "Event" ADD CONSTRAINT "Event_organisationId_slug_key" UNIQUE ("organisationId", "slug");
