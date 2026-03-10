-- CreateEnum
CREATE TYPE "WeighInPolicyCode" AS ENUM (
  'IWUF_STRICT_ONE_HOUR',
  'MOVE_UP_AFTER_FAILED_REWEIGH',
  'DIRECT_MOVE_UP',
  'MANUAL_ADMIN_DECISION'
);

-- CreateEnum
CREATE TYPE "BronzePolicyCode" AS ENUM (
  'TWO_BRONZES'
);

-- CreateEnum
CREATE TYPE "RestPolicyCode" AS ENUM (
  'MIN_15_MINUTES'
);

-- CreateEnum
CREATE TYPE "PublishTimingPolicyCode" AS ENUM (
  'IMMEDIATE_AFTER_DRAW',
  'MANUAL_PUBLISH_LATER',
  'COMPETITION_DAY_ONLY'
);

-- AlterEnum
ALTER TYPE "WeighInStatus" ADD VALUE 'REWEIGH_ALLOWED';

-- AlterEnum
ALTER TYPE "WeighInStatus" ADD VALUE 'DISQUALIFIED';

-- AlterEnum
ALTER TYPE "WeighInDecision" ADD VALUE 'DISQUALIFIED';

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "weighInPolicyCode" "WeighInPolicyCode" NOT NULL DEFAULT 'IWUF_STRICT_ONE_HOUR',
  ADD COLUMN "bronzePolicyCode" "BronzePolicyCode" NOT NULL DEFAULT 'TWO_BRONZES',
  ADD COLUMN "restPolicyCode" "RestPolicyCode" NOT NULL DEFAULT 'MIN_15_MINUTES',
  ADD COLUMN "minRestMinutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "publishTimingPolicyCode" "PublishTimingPolicyCode" NOT NULL DEFAULT 'IMMEDIATE_AFTER_DRAW',
  ADD COLUMN "reweighWindowMinutes" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "WeighInAttempt"
  ADD COLUMN "policyCode" "WeighInPolicyCode" NOT NULL DEFAULT 'IWUF_STRICT_ONE_HOUR';

-- CreateIndex
CREATE INDEX "WeighInAttempt_policyCode_idx"
ON "WeighInAttempt"("policyCode");
