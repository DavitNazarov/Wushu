-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduleSession" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ScheduleSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable – add sessionId to Fight
ALTER TABLE "Fight"
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScheduleSession_organisationId_eventId_idx"
ON "ScheduleSession"("organisationId", "eventId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_organisationId_fkey'
  ) THEN
    ALTER TABLE "ScheduleSession"
    ADD CONSTRAINT "ScheduleSession_organisationId_fkey"
    FOREIGN KEY ("organisationId")
    REFERENCES "Organisation"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_eventId_fkey'
  ) THEN
    ALTER TABLE "ScheduleSession"
    ADD CONSTRAINT "ScheduleSession_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "Event"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Fight_sessionId_fkey'
  ) THEN
    ALTER TABLE "Fight"
    ADD CONSTRAINT "Fight_sessionId_fkey"
    FOREIGN KEY ("sessionId")
    REFERENCES "ScheduleSession"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;
