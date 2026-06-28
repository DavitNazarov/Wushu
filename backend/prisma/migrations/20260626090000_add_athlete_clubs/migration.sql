CREATE TABLE "AthleteClub" (
    "athleteId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteClub_pkey" PRIMARY KEY ("athleteId","clubId")
);

CREATE INDEX "AthleteClub_clubId_idx" ON "AthleteClub"("clubId");

ALTER TABLE "AthleteClub" ADD CONSTRAINT "AthleteClub_athleteId_fkey"
FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AthleteClub" ADD CONSTRAINT "AthleteClub_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AthleteClub" ("athleteId", "clubId", "createdAt")
SELECT "id", "clubId", CURRENT_TIMESTAMP
FROM "Athlete"
WHERE "clubId" IS NOT NULL
ON CONFLICT DO NOTHING;
