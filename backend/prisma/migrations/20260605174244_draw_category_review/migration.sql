-- AlterTable
ALTER TABLE "EventWeightCategory" ADD COLUMN     "drawReviewSignature" TEXT,
ADD COLUMN     "drawReviewedAt" TIMESTAMP(3),
ADD COLUMN     "drawReviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "EventWeightCategory" ADD CONSTRAINT "EventWeightCategory_drawReviewedById_fkey" FOREIGN KEY ("drawReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
