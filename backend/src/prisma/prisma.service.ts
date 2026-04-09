import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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
   * Runs via the same connection pool the app uses so it always targets
   * the correct database regardless of how build-time env vars are wired.
   */
  private async repairSchema() {
    try {
      await this.$executeRaw`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TimerPhaseEnum') THEN
            CREATE TYPE "TimerPhaseEnum" AS ENUM ('ROUND', 'REST', 'FINISHED');
          END IF;
        END $$
      `;
      await this.$executeRaw`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FightSlot') THEN
            CREATE TYPE "FightSlot" AS ENUM ('RED', 'BLUE');
          END IF;
        END $$
      `;
      await this.$executeRaw`
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
      `;
      await this.$executeRaw`
        ALTER TABLE "Fight"
          ADD COLUMN IF NOT EXISTS "eventWeightCategoryId" TEXT,
          ADD COLUMN IF NOT EXISTS "roundDurationSeconds"  INTEGER
      `;
      this.logger.log('Schema repair complete');
    } catch (err) {
      this.logger.error('Schema repair failed', err);
      throw err;
    }
  }
}
