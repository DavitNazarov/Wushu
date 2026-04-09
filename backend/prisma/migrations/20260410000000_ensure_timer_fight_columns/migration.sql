-- Idempotent repair migration.
-- The previous migration (20260327143000_add_timer_round_flow) may have been
-- recorded as applied in _prisma_migrations without the DDL actually executing
-- on the production database (Prisma drift). This migration re-applies all
-- missing columns using IF NOT EXISTS guards so it is always safe to run.

-- Ensure TimerPhaseEnum type exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimerPhaseEnum') THEN
    CREATE TYPE "TimerPhaseEnum" AS ENUM ('ROUND', 'REST', 'FINISHED');
  END IF;
END
$$;

-- Ensure FightSlot type exists (needed for round winner columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FightSlot') THEN
    CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');
  END IF;
END
$$;

-- Re-apply TimerState columns
ALTER TABLE "TimerState"
  ADD COLUMN IF NOT EXISTS "phase"                "TimerPhaseEnum" NOT NULL DEFAULT 'ROUND',
  ADD COLUMN IF NOT EXISTS "phaseDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS "roundDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS "restDurationSeconds"  INTEGER          NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "redRoundWins"         INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "blueRoundWins"        INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "round1Winner"         "FightSlot",
  ADD COLUMN IF NOT EXISTS "round2Winner"         "FightSlot",
  ADD COLUMN IF NOT EXISTS "round3Winner"         "FightSlot";

-- Ensure Fight columns added in 20260311120000_add_weight_category_schema
ALTER TABLE "Fight"
  ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER;
