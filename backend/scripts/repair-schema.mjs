/**
 * Idempotent schema repair script.
 * Runs directly via pg (bypasses Prisma migration tracking) so it works
 * even when columns are missing but migrations are already marked applied.
 *
 * On Neon: prefers DIRECT_URL over DATABASE_URL because DDL (ALTER TABLE,
 * CREATE TYPE) must go through the direct connection, not the pooled one.
 */
import pg from 'pg';
import { config } from 'dotenv';

config();

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('repair-schema: neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

const statements = [
  // Ensure TimerPhaseEnum type
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimerPhaseEnum') THEN
       CREATE TYPE "TimerPhaseEnum" AS ENUM ('ROUND', 'REST', 'FINISHED');
     END IF;
   END $$`,

  // Ensure FightSlot type
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FightSlot') THEN
       CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');
     END IF;
   END $$`,

  // TimerState columns
  `ALTER TABLE "TimerState"
     ADD COLUMN IF NOT EXISTS "phase"                "TimerPhaseEnum" NOT NULL DEFAULT 'ROUND',
     ADD COLUMN IF NOT EXISTS "phaseDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
     ADD COLUMN IF NOT EXISTS "roundDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
     ADD COLUMN IF NOT EXISTS "restDurationSeconds"  INTEGER          NOT NULL DEFAULT 60,
     ADD COLUMN IF NOT EXISTS "redRoundWins"         INTEGER          NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS "blueRoundWins"        INTEGER          NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS "round1Winner"         "FightSlot",
     ADD COLUMN IF NOT EXISTS "round2Winner"         "FightSlot",
     ADD COLUMN IF NOT EXISTS "round3Winner"         "FightSlot"`,

  // Fight columns
  `ALTER TABLE "Fight"
     ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
     ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER,
     ADD COLUMN IF NOT EXISTS "sessionId"             TEXT`,

  // ScheduleSession table
  `CREATE TABLE IF NOT EXISTS "ScheduleSession" (
     "id"             TEXT         NOT NULL,
     "organisationId" TEXT         NOT NULL,
     "eventId"        TEXT         NOT NULL,
     "name"           TEXT         NOT NULL,
     "startTime"      TIMESTAMP(3) NOT NULL,
     "endTime"        TIMESTAMP(3) NOT NULL,
     "order"          INTEGER      NOT NULL,
     CONSTRAINT "ScheduleSession_pkey" PRIMARY KEY ("id")
   )`,

  `CREATE INDEX IF NOT EXISTS "ScheduleSession_organisationId_eventId_idx"
     ON "ScheduleSession"("organisationId", "eventId")`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_organisationId_fkey') THEN
       ALTER TABLE "ScheduleSession"
         ADD CONSTRAINT "ScheduleSession_organisationId_fkey"
         FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_eventId_fkey') THEN
       ALTER TABLE "ScheduleSession"
         ADD CONSTRAINT "ScheduleSession_eventId_fkey"
         FOREIGN KEY ("eventId") REFERENCES "Event"("id")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Fight_sessionId_fkey') THEN
       ALTER TABLE "Fight"
         ADD CONSTRAINT "Fight_sessionId_fkey"
         FOREIGN KEY ("sessionId") REFERENCES "ScheduleSession"("id")
         ON DELETE SET NULL ON UPDATE CASCADE;
     END IF;
   END $$`,
];

try {
  await client.connect();

  // Kill any zombie sessions holding the Prisma migration advisory lock
  // so that the subsequent `prisma migrate deploy` can acquire it immediately.
  // pg_advisory_lock(72707369) stores as classid=0, objid=72707369 in pg_locks.
  const { rows } = await client.query(`
    SELECT pg_terminate_backend(pid) AS terminated, pid
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
      AND objid = 72707369
      AND pid <> pg_backend_pid()
  `);
  if (rows.length > 0) {
    console.log(`repair-schema: released ${rows.length} stuck migration lock(s) — pids: ${rows.map(r => r.pid).join(', ')}`);
  }

  console.log('repair-schema: connected, applying idempotent fixes…');
  for (const sql of statements) {
    await client.query(sql);
  }
  console.log('repair-schema: done ✓');
} catch (err) {
  console.error('repair-schema: FAILED —', err.message);
  process.exit(1);
} finally {
  await client.end();
}
