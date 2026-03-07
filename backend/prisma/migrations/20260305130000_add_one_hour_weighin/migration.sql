-- AlterEnum
ALTER TYPE "WeighInDecision" ADD VALUE 'ONE_HOUR';

-- AlterTable
ALTER TABLE "WeighInAttempt"
  ADD COLUMN "deadlineAt"     TIMESTAMP(3),
  ADD COLUMN "resolvedAt"     TIMESTAMP(3),
  ADD COLUMN "resolvedAction" TEXT;
