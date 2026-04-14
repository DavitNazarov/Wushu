-- AlterTable: add orderInSession to Fight
ALTER TABLE "Fight"
  ADD COLUMN IF NOT EXISTS "orderInSession" INTEGER;

-- Index for session ordering
CREATE INDEX IF NOT EXISTS "Fight_sessionId_orderInSession_idx"
  ON "Fight"("sessionId", "orderInSession");
