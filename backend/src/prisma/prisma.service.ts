import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.repairSchema();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Idempotent repair for columns that Prisma drift may have left missing.
   * Uses a direct pg connection (DIRECT_URL) so DDL is never routed through
   * the PgBouncer pooler, which can silently drop uncommitted DDL on Neon.
   */
  private async repairSchema() {
    const connectionString =
      process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Neither DIRECT_URL nor DATABASE_URL is set');
    }
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimerPhaseEnum') THEN
            CREATE TYPE "TimerPhaseEnum" AS ENUM ('ROUND', 'REST', 'FINISHED');
          END IF;
        END $$
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FightSlot') THEN
            CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');
          END IF;
        END $$
      `);
      await client.query(`
        ALTER TABLE "TimerState"
          ADD COLUMN IF NOT EXISTS "phase"                "TimerPhaseEnum" NOT NULL DEFAULT 'ROUND',
          ADD COLUMN IF NOT EXISTS "phaseDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
          ADD COLUMN IF NOT EXISTS "roundDurationSeconds" INTEGER          NOT NULL DEFAULT 120,
          ADD COLUMN IF NOT EXISTS "restDurationSeconds"  INTEGER          NOT NULL DEFAULT 60,
          ADD COLUMN IF NOT EXISTS "redRoundWins"         INTEGER          NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "blueRoundWins"        INTEGER          NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS "round1Winner"         "FightSlot",
          ADD COLUMN IF NOT EXISTS "round2Winner"         "FightSlot",
          ADD COLUMN IF NOT EXISTS "round3Winner"         "FightSlot"
      `);
      await client.query(`
        ALTER TABLE "Fight"
          ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
          ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER,
          ADD COLUMN IF NOT EXISTS "sessionId"             TEXT
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS "ScheduleSession" (
          "id"             TEXT          NOT NULL,
          "organisationId" TEXT          NOT NULL,
          "eventId"        TEXT          NOT NULL,
          "name"           TEXT          NOT NULL,
          "startTime"      TIMESTAMP(3)  NOT NULL,
          "endTime"        TIMESTAMP(3)  NOT NULL,
          "order"          INTEGER       NOT NULL,
          CONSTRAINT "ScheduleSession_pkey" PRIMARY KEY ("id")
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS "ScheduleSession_organisationId_eventId_idx"
        ON "ScheduleSession"("organisationId", "eventId")
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_organisationId_fkey') THEN
            ALTER TABLE "ScheduleSession"
              ADD CONSTRAINT "ScheduleSession_organisationId_fkey"
              FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id")
              ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduleSession_eventId_fkey') THEN
            ALTER TABLE "ScheduleSession"
              ADD CONSTRAINT "ScheduleSession_eventId_fkey"
              FOREIGN KEY ("eventId") REFERENCES "Event"("id")
              ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$
      `);
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Fight_sessionId_fkey') THEN
            ALTER TABLE "Fight"
              ADD CONSTRAINT "Fight_sessionId_fkey"
              FOREIGN KEY ("sessionId") REFERENCES "ScheduleSession"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$
      `);
      this.logger.log('Schema repair complete');
    } catch (err) {
      this.logger.error('Schema repair failed', err);
      throw err;
    } finally {
      await client.end();
    }
  }
}
