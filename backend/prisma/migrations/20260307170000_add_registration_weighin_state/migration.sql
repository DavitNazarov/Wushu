-- CreateEnum
CREATE TYPE "WeighInStatus" AS ENUM (
  'NOT_WEIGHED',
  'PASSED',
  'MOVED_UP',
  'FAILED',
  'OVERRIDE_APPROVED'
);

-- AlterEnum
ALTER TYPE "WeighInDecision" ADD VALUE 'MOVED_UP';

-- AlterTable
ALTER TABLE "Registration"
  ADD COLUMN "registeredEventWeightCategoryId" TEXT,
  ADD COLUMN "weighInStatus" "WeighInStatus" NOT NULL DEFAULT 'NOT_WEIGHED';

UPDATE "Registration"
SET "registeredEventWeightCategoryId" = "eventWeightCategoryId"
WHERE "registeredEventWeightCategoryId" IS NULL;

-- CreateIndex
CREATE INDEX "Registration_registeredEventWeightCategoryId_idx"
ON "Registration"("registeredEventWeightCategoryId");

-- CreateIndex
CREATE INDEX "Registration_weighInStatus_idx"
ON "Registration"("weighInStatus");

-- AddForeignKey
ALTER TABLE "Registration"
ADD CONSTRAINT "Registration_registeredEventWeightCategoryId_fkey"
FOREIGN KEY ("registeredEventWeightCategoryId")
REFERENCES "EventWeightCategory"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
