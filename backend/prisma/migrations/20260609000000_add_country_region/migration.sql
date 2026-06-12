-- Country → Region → Club geography hierarchy.
-- Adds Country + Region tables, links Club/User/Athlete to them, and backfills
-- existing data from the free-text Club.country string (per organisation) before
-- making Club.regionId/countryId required and dropping Club.country.

-- CreateTable: Country
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Region
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_organisationId_name_key" ON "Country"("organisationId", "name");
CREATE INDEX "Country_organisationId_idx" ON "Country"("organisationId");
CREATE UNIQUE INDEX "Region_organisationId_countryId_name_key" ON "Region"("organisationId", "countryId", "name");
CREATE INDEX "Region_organisationId_idx" ON "Region"("organisationId");
CREATE INDEX "Region_countryId_idx" ON "Region"("countryId");

-- AddForeignKey: Country/Region → Organisation, Region → Country
ALTER TABLE "Country" ADD CONSTRAINT "Country_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Region" ADD CONSTRAINT "Region_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Region" ADD CONSTRAINT "Region_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add nullable FK columns first so we can backfill before NOT NULL
ALTER TABLE "Club" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Club" ADD COLUMN "countryId" TEXT;
ALTER TABLE "User" ADD COLUMN "regionId" TEXT;
ALTER TABLE "User" ADD COLUMN "countryId" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "regionId" TEXT;
ALTER TABLE "Athlete" ADD COLUMN "countryId" TEXT;

-- Backfill (1): one Country per distinct existing Club.country string, per org.
-- NULL/empty country → "Unassigned". Georgia variants get ISO code "GE".
INSERT INTO "Country" ("id", "organisationId", "name", "code", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, x."organisationId", x."name", x."code", NOW(), NOW()
FROM (
    SELECT DISTINCT
        "organisationId",
        COALESCE(NULLIF(TRIM("country"), ''), 'Unassigned') AS "name",
        CASE WHEN LOWER(TRIM("country")) IN ('ge', 'geo', 'georgia') THEN 'GE' ELSE NULL END AS "code"
    FROM "Club"
) x;

-- Backfill (2): one default Region per Country, named after the country.
INSERT INTO "Region" ("id", "organisationId", "countryId", "name", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, co."organisationId", co."id", co."name", NOW(), NOW()
FROM "Country" co;

-- Backfill (3): point each Club at its Country + default Region.
UPDATE "Club" cl
SET "countryId" = co."id",
    "regionId" = r."id"
FROM "Country" co
JOIN "Region" r ON r."countryId" = co."id" AND r."organisationId" = co."organisationId"
WHERE co."organisationId" = cl."organisationId"
  AND co."name" = COALESCE(NULLIF(TRIM(cl."country"), ''), 'Unassigned');

-- Backfill (4): coaches/athletes inherit region+country from their club.
UPDATE "User" u
SET "regionId" = cl."regionId", "countryId" = cl."countryId"
FROM "Club" cl
WHERE cl."id" = u."clubId";

UPDATE "Athlete" a
SET "regionId" = cl."regionId", "countryId" = cl."countryId"
FROM "Club" cl
WHERE cl."id" = a."clubId";

-- AlterTable: Club region/country now required
ALTER TABLE "Club" ALTER COLUMN "regionId" SET NOT NULL;
ALTER TABLE "Club" ALTER COLUMN "countryId" SET NOT NULL;

-- AddForeignKey: Club (required), User/Athlete (nullable)
ALTER TABLE "Club" ADD CONSTRAINT "Club_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Club" ADD CONSTRAINT "Club_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: new FK columns
CREATE INDEX "Club_regionId_idx" ON "Club"("regionId");
CREATE INDEX "Club_countryId_idx" ON "Club"("countryId");
CREATE INDEX "User_regionId_idx" ON "User"("regionId");
CREATE INDEX "User_countryId_idx" ON "User"("countryId");
CREATE INDEX "Athlete_regionId_idx" ON "Athlete"("regionId");
CREATE INDEX "Athlete_countryId_idx" ON "Athlete"("countryId");

-- DropColumn: free-text country replaced by the Country relation
ALTER TABLE "Club" DROP COLUMN "country";
