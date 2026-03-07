-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WeighInDecision" AS ENUM ('PASS', 'REWEIGH', 'FAIL');

-- CreateEnum
CREATE TYPE "FightStatus" AS ENUM ('QUEUED', 'ON_DECK', 'IN_PROGRESS', 'PAUSED', 'COMPLETE', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "TimerStateEnum" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "WinMethod" AS ENUM ('POINTS', 'KO', 'DQ', 'WO');

-- CreateEnum
CREATE TYPE "AthleteSex" AS ENUM ('MALE', 'FEMALE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'judge';
ALTER TYPE "UserRole" ADD VALUE 'timekeeper';

-- DropIndex
DROP INDEX "Event_slug_key";

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN     "sex" "AthleteSex";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "registrationStartDate" DROP DEFAULT,
ALTER COLUMN "registrationEndDate" DROP DEFAULT,
ALTER COLUMN "competitionStartDate" DROP DEFAULT,
ALTER COLUMN "competitionEndDate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clubId" TEXT;

-- CreateTable
CREATE TABLE "AthleteMerge" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "primaryAthleteId" TEXT NOT NULL,
    "secondaryAthleteId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "mergedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteMerge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "clubId" TEXT,
    "categoryCode" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeighInAttempt" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "decision" "WeighInDecision" NOT NULL,
    "operatorUserId" TEXT,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeighInAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mat" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Mat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fight" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bracketId" TEXT,
    "categoryCode" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "boutNo" INTEGER NOT NULL,
    "redAthleteId" TEXT,
    "blueAthleteId" TEXT,
    "status" "FightStatus" NOT NULL DEFAULT 'QUEUED',
    "matId" TEXT,
    "orderInMat" INTEGER,
    "scheduledStartTime" TIMESTAMP(3),
    "winnerAthleteId" TEXT,
    "winMethod" "WinMethod",
    "notes" TEXT,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimerState" (
    "fightId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "state" "TimerStateEnum" NOT NULL DEFAULT 'IDLE',
    "round" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedMs" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "TimerState_pkey" PRIMARY KEY ("fightId")
);

-- CreateIndex
CREATE INDEX "Registration_organisationId_eventId_idx" ON "Registration"("organisationId", "eventId");

-- CreateIndex
CREATE INDEX "Registration_organisationId_eventId_status_idx" ON "Registration"("organisationId", "eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_athleteId_key" ON "Registration"("eventId", "athleteId");

-- CreateIndex
CREATE INDEX "WeighInAttempt_organisationId_eventId_idx" ON "WeighInAttempt"("organisationId", "eventId");

-- CreateIndex
CREATE INDEX "WeighInAttempt_registrationId_idx" ON "WeighInAttempt"("registrationId");

-- CreateIndex
CREATE INDEX "Mat_organisationId_eventId_idx" ON "Mat"("organisationId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Mat_eventId_name_key" ON "Mat"("eventId", "name");

-- CreateIndex
CREATE INDEX "Bracket_organisationId_eventId_idx" ON "Bracket"("organisationId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_eventId_categoryCode_key" ON "Bracket"("eventId", "categoryCode");

-- CreateIndex
CREATE INDEX "Fight_organisationId_eventId_idx" ON "Fight"("organisationId", "eventId");

-- CreateIndex
CREATE INDEX "Fight_organisationId_eventId_status_idx" ON "Fight"("organisationId", "eventId", "status");

-- CreateIndex
CREATE INDEX "Fight_matId_orderInMat_idx" ON "Fight"("matId", "orderInMat");

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_primaryAthleteId_fkey" FOREIGN KEY ("primaryAthleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMerge" ADD CONSTRAINT "AthleteMerge_secondaryAthleteId_fkey" FOREIGN KEY ("secondaryAthleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighInAttempt" ADD CONSTRAINT "WeighInAttempt_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighInAttempt" ADD CONSTRAINT "WeighInAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighInAttempt" ADD CONSTRAINT "WeighInAttempt_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeighInAttempt" ADD CONSTRAINT "WeighInAttempt_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mat" ADD CONSTRAINT "Mat_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mat" ADD CONSTRAINT "Mat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bracket" ADD CONSTRAINT "Bracket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_matId_fkey" FOREIGN KEY ("matId") REFERENCES "Mat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_redAthleteId_fkey" FOREIGN KEY ("redAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_blueAthleteId_fkey" FOREIGN KEY ("blueAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_winnerAthleteId_fkey" FOREIGN KEY ("winnerAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerState" ADD CONSTRAINT "TimerState_fightId_fkey" FOREIGN KEY ("fightId") REFERENCES "Fight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerState" ADD CONSTRAINT "TimerState_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerState" ADD CONSTRAINT "TimerState_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
