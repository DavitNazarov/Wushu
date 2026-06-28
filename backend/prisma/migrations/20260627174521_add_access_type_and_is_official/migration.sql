-- CreateEnum
CREATE TYPE "EventAccessType" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "accessType" "EventAccessType" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Federation" ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT true;
