-- CreateEnum
CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');

-- AlterTable
ALTER TABLE "Fight"
ADD COLUMN "loserAthleteId" TEXT,
ADD COLUMN "nextFightId" TEXT,
ADD COLUMN "nextFightSlot" "FightSlot";

-- Backfill dependency graph for existing single-elimination fights.
UPDATE "Fight" AS child
SET
  "nextFightId" = parent."id",
  "nextFightSlot" = CASE
    WHEN (child."boutNo" % 2) = 1 THEN 'RED'::"FightSlot"
    ELSE 'BLUE'::"FightSlot"
  END
FROM "Fight" AS parent
WHERE
  child."bracketId" IS NOT NULL
  AND parent."bracketId" = child."bracketId"
  AND parent."round" = child."round" + 1
  AND parent."boutNo" = ((child."boutNo" + 1) / 2);

-- CreateIndex
CREATE INDEX "Fight_nextFightId_idx" ON "Fight"("nextFightId");

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_loserAthleteId_fkey" FOREIGN KEY ("loserAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_nextFightId_fkey" FOREIGN KEY ("nextFightId") REFERENCES "Fight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
