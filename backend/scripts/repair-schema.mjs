/**
 * Idempotent schema repair script.
 * Runs directly via pg (bypasses Prisma migration tracking) so it works
 * even when columns are missing but migrations are already marked applied.
 *
 * On Neon: prefers DIRECT_URL over DATABASE_URL because DDL (ALTER TABLE,
 * CREATE TYPE) must go through the direct connection, not the pooled one.
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
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
     ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER`,
];

try {
  await client.connect();
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
