ALTER TABLE "User"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "dqReason" TEXT,
ADD COLUMN "dqStartAt" TIMESTAMP(3),
ADD COLUMN "dqEndAt" TIMESTAMP(3),
ADD COLUMN "dqNote" TEXT;

CREATE INDEX "User_organisationId_deletedAt_idx" ON "User"("organisationId", "deletedAt");
