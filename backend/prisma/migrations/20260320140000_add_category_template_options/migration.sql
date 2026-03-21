CREATE TABLE "CategoryOptionGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sex" "AthleteSex",
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "roundDurationSeconds" INTEGER NOT NULL DEFAULT 120,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryOption" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minWeightKgExcl" DOUBLE PRECISION,
    "maxWeightKgIncl" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryOptionGroup_code_key" ON "CategoryOptionGroup"("code");
CREATE INDEX "CategoryOptionGroup_isActive_sortOrder_idx" ON "CategoryOptionGroup"("isActive", "sortOrder");
CREATE UNIQUE INDEX "CategoryOption_code_key" ON "CategoryOption"("code");
CREATE INDEX "CategoryOption_groupId_isActive_sortOrder_idx" ON "CategoryOption"("groupId", "isActive", "sortOrder");

ALTER TABLE "CategoryOption"
    ADD CONSTRAINT "CategoryOption_groupId_fkey"
    FOREIGN KEY ("groupId")
    REFERENCES "CategoryOptionGroup"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
