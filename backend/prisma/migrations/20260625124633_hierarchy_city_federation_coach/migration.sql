/*
  Warnings:

  - You are about to drop the column `regionId` on the `Athlete` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Club` table. All the data in the column will be lost.
  - You are about to drop the column `regionId` on the `Club` table. All the data in the column will be lost.
  - You are about to drop the column `regionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Region` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `cityId` to the `Club` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Athlete" DROP CONSTRAINT "Athlete_regionId_fkey";

-- DropForeignKey
ALTER TABLE "Club" DROP CONSTRAINT "Club_regionId_fkey";

-- DropForeignKey
ALTER TABLE "Region" DROP CONSTRAINT "Region_countryId_fkey";

-- DropForeignKey
ALTER TABLE "Region" DROP CONSTRAINT "Region_organisationId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_regionId_fkey";

-- DropIndex
DROP INDEX "Athlete_regionId_idx";

-- DropIndex
DROP INDEX "Club_regionId_idx";

-- DropIndex
DROP INDEX "User_regionId_idx";

-- AlterTable
ALTER TABLE "Athlete" DROP COLUMN "regionId",
ADD COLUMN     "cityId" TEXT;

-- AlterTable
ALTER TABLE "Club" DROP COLUMN "city",
DROP COLUMN "regionId",
ADD COLUMN     "cityId" TEXT NOT NULL,
ADD COLUMN     "federationId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "regionId",
ADD COLUMN     "cityId" TEXT;

-- DropTable
DROP TABLE "Region";

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Federation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Federation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "clubId" TEXT,
    "firstName" TEXT NOT NULL,
    "firstNameKa" TEXT,
    "lastName" TEXT NOT NULL,
    "lastNameKa" TEXT,
    "nationality" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteCoach" (
    "athleteId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,

    CONSTRAINT "AthleteCoach_pkey" PRIMARY KEY ("athleteId","coachId")
);

-- CreateIndex
CREATE INDEX "City_organisationId_idx" ON "City"("organisationId");

-- CreateIndex
CREATE INDEX "City_countryId_idx" ON "City"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "City_organisationId_countryId_name_key" ON "City"("organisationId", "countryId", "name");

-- CreateIndex
CREATE INDEX "Federation_organisationId_idx" ON "Federation"("organisationId");

-- CreateIndex
CREATE INDEX "Federation_cityId_idx" ON "Federation"("cityId");

-- CreateIndex
CREATE INDEX "Federation_countryId_idx" ON "Federation"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "Federation_organisationId_cityId_name_key" ON "Federation"("organisationId", "cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Coach_userId_key" ON "Coach"("userId");

-- CreateIndex
CREATE INDEX "Coach_organisationId_idx" ON "Coach"("organisationId");

-- CreateIndex
CREATE INDEX "Coach_clubId_idx" ON "Coach"("clubId");

-- CreateIndex
CREATE INDEX "Coach_cityId_idx" ON "Coach"("cityId");

-- CreateIndex
CREATE INDEX "Coach_countryId_idx" ON "Coach"("countryId");

-- CreateIndex
CREATE INDEX "AthleteCoach_coachId_idx" ON "AthleteCoach"("coachId");

-- CreateIndex
CREATE INDEX "Athlete_cityId_idx" ON "Athlete"("cityId");

-- CreateIndex
CREATE INDEX "Club_cityId_idx" ON "Club"("cityId");

-- CreateIndex
CREATE INDEX "Club_federationId_idx" ON "Club"("federationId");

-- CreateIndex
CREATE INDEX "User_cityId_idx" ON "User"("cityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federation" ADD CONSTRAINT "Federation_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federation" ADD CONSTRAINT "Federation_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Federation" ADD CONSTRAINT "Federation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_federationId_fkey" FOREIGN KEY ("federationId") REFERENCES "Federation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coach" ADD CONSTRAINT "Coach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteCoach" ADD CONSTRAINT "AthleteCoach_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteCoach" ADD CONSTRAINT "AthleteCoach_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
