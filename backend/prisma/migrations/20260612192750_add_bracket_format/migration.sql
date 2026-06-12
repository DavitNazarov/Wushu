-- CreateEnum
CREATE TYPE "BracketFormat" AS ENUM ('DIRECT_FINAL', 'ROUND_ROBIN', 'SINGLE_ELIMINATION');

-- AlterTable
ALTER TABLE "Bracket" ADD COLUMN     "format" "BracketFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION';

-- Backfill historical brackets. Format was previously implicit in the fight
-- tree shape:
--   DIRECT_FINAL  — exactly one fight (0-2 athletes, single final)
--   ROUND_ROBIN   — multiple fights, none of which links to a next fight
--                   (everyone-plays-everyone pools have no progression edges)
--   SINGLE_ELIMINATION — everything else (the column default)
UPDATE "Bracket" b
SET "format" = 'DIRECT_FINAL'
WHERE (SELECT COUNT(*) FROM "Fight" f WHERE f."bracketId" = b.id) = 1;

UPDATE "Bracket" b
SET "format" = 'ROUND_ROBIN'
WHERE (SELECT COUNT(*) FROM "Fight" f WHERE f."bracketId" = b.id) > 1
  AND NOT EXISTS (
    SELECT 1 FROM "Fight" f
    WHERE f."bracketId" = b.id AND f."nextFightId" IS NOT NULL
  );
