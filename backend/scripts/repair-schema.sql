-- Force-apply any columns that Prisma drift may have left missing.
-- All statements are idempotent (IF NOT EXISTS), so this is always safe to run.

-- TimerPhaseEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimerPhaseEnum') THEN
    CREATE TYPE "TimerPhaseEnum" AS ENUM ('ROUND', 'REST', 'FINISHED');
  END IF;
END $$;

-- FightSlot (created in an earlier migration, guard just in case)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FightSlot') THEN
    CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');
  END IF;
END $$;

-- TimerState columns
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

-- Fight columns
ALTER TABLE "Fight"
  ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER;
