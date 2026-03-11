-- The committed migration history never created the weight-category tables,
-- but the application schema and code depend on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "RulesetAgeGroup" (
    "id" TEXT NOT NULL,
    "rulesetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sex" "AthleteSex",
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "roundDurationSeconds" INTEGER NOT NULL DEFAULT 120,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RulesetAgeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RulesetWeightCategory" (
    "id" TEXT NOT NULL,
    "ageGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minWeightKgExcl" DOUBLE PRECISION,
    "maxWeightKgIncl" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RulesetWeightCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventAgeGroup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rulesetAgeGroupId" TEXT NOT NULL,

    CONSTRAINT "EventAgeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EventWeightCategory" (
    "id" TEXT NOT NULL,
    "eventAgeGroupId" TEXT NOT NULL,
    "rulesetWeightCategoryId" TEXT NOT NULL,

    CONSTRAINT "EventWeightCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Registration"
  ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Fight"
  ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "roundDurationSeconds" INTEGER;

-- Backfill registered category from final category when both columns exist.
UPDATE "Registration"
SET "registeredEventWeightCategoryId" = "eventWeightCategoryId"
WHERE "registeredEventWeightCategoryId" IS NULL
  AND "eventWeightCategoryId" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RulesetAgeGroup_rulesetId_idx"
ON "RulesetAgeGroup"("rulesetId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RulesetAgeGroup_rulesetId_code_key"
ON "RulesetAgeGroup"("rulesetId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RulesetWeightCategory_ageGroupId_idx"
ON "RulesetWeightCategory"("ageGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventAgeGroup_eventId_idx"
ON "EventAgeGroup"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventAgeGroup_eventId_rulesetAgeGroupId_key"
ON "EventAgeGroup"("eventId", "rulesetAgeGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventWeightCategory_eventAgeGroupId_idx"
ON "EventWeightCategory"("eventAgeGroupId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EventWeightCategory_eventAgeGroupId_rulesetWeightCategoryId_key"
ON "EventWeightCategory"("eventAgeGroupId", "rulesetWeightCategoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Registration_eventWeightCategoryId_idx"
ON "Registration"("eventWeightCategoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fight_eventWeightCategoryId_idx"
ON "Fight"("eventWeightCategoryId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RulesetAgeGroup_rulesetId_fkey'
  ) THEN
    ALTER TABLE "RulesetAgeGroup"
    ADD CONSTRAINT "RulesetAgeGroup_rulesetId_fkey"
    FOREIGN KEY ("rulesetId")
    REFERENCES "Ruleset"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RulesetWeightCategory_ageGroupId_fkey'
  ) THEN
    ALTER TABLE "RulesetWeightCategory"
    ADD CONSTRAINT "RulesetWeightCategory_ageGroupId_fkey"
    FOREIGN KEY ("ageGroupId")
    REFERENCES "RulesetAgeGroup"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventAgeGroup_eventId_fkey'
  ) THEN
    ALTER TABLE "EventAgeGroup"
    ADD CONSTRAINT "EventAgeGroup_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "Event"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventAgeGroup_rulesetAgeGroupId_fkey'
  ) THEN
    ALTER TABLE "EventAgeGroup"
    ADD CONSTRAINT "EventAgeGroup_rulesetAgeGroupId_fkey"
    FOREIGN KEY ("rulesetAgeGroupId")
    REFERENCES "RulesetAgeGroup"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventWeightCategory_eventAgeGroupId_fkey'
  ) THEN
    ALTER TABLE "EventWeightCategory"
    ADD CONSTRAINT "EventWeightCategory_eventAgeGroupId_fkey"
    FOREIGN KEY ("eventAgeGroupId")
    REFERENCES "EventAgeGroup"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventWeightCategory_rulesetWeightCategoryId_fkey'
  ) THEN
    ALTER TABLE "EventWeightCategory"
    ADD CONSTRAINT "EventWeightCategory_rulesetWeightCategoryId_fkey"
    FOREIGN KEY ("rulesetWeightCategoryId")
    REFERENCES "RulesetWeightCategory"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Registration_eventWeightCategoryId_fkey'
  ) THEN
    ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_eventWeightCategoryId_fkey"
    FOREIGN KEY ("eventWeightCategoryId")
    REFERENCES "EventWeightCategory"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Registration_registeredEventWeightCategoryId_fkey'
  ) THEN
    ALTER TABLE "Registration"
    ADD CONSTRAINT "Registration_registeredEventWeightCategoryId_fkey"
    FOREIGN KEY ("registeredEventWeightCategoryId")
    REFERENCES "EventWeightCategory"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Fight_eventWeightCategoryId_fkey'
  ) THEN
    ALTER TABLE "Fight"
    ADD CONSTRAINT "Fight_eventWeightCategoryId_fkey"
    FOREIGN KEY ("eventWeightCategoryId")
    REFERENCES "EventWeightCategory"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;
