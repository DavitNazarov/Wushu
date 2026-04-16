-- AlterTable: User — add nationality
ALTER TABLE "User" ADD COLUMN "nationality" TEXT;

-- AlterTable: Event — add nameKa
ALTER TABLE "Event" ADD COLUMN "nameKa" TEXT;

-- AlterTable: Club — add nameKa
ALTER TABLE "Club" ADD COLUMN "nameKa" TEXT;

-- AlterTable: Athlete — add bilingual name fields
ALTER TABLE "Athlete" ADD COLUMN "firstNameKa" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "lastNameKa" TEXT;

-- Backfill NULL documentIds with placeholder before making NOT NULL
UPDATE "Athlete" SET "documentId" = 'LEGACY_' || "id" WHERE "documentId" IS NULL OR "documentId" = '';

-- AlterTable: Athlete — make documentId required
ALTER TABLE "Athlete" ALTER COLUMN "documentId" SET NOT NULL;

-- CreateIndex: unique documentId per organisation
CREATE UNIQUE INDEX "Athlete_organisationId_documentId_key" ON "Athlete"("organisationId", "documentId");
