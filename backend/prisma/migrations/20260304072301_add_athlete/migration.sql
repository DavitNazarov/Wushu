-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "clubId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Athlete_organisationId_lastName_firstName_idx" ON "Athlete"("organisationId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Athlete_organisationId_dateOfBirth_documentId_idx" ON "Athlete"("organisationId", "dateOfBirth", "documentId");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
