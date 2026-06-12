-- AlterTable
ALTER TABLE "CategoryOptionGroup" ADD COLUMN     "nameKa" TEXT;

-- AlterTable
ALTER TABLE "CategoryTemplateAgeGroup" ADD COLUMN     "nameKa" TEXT;

-- RenameForeignKey
ALTER TABLE "CategoryTemplateAgeGroup" RENAME CONSTRAINT "CategoryTemplateAgeGroup_categoryTemplateId_fkey" TO "CategoryTemplateAgeGroup_rulesetId_fkey";

-- RenameIndex
ALTER INDEX "CategoryTemplateAgeGroup_categoryTemplateId_code_key" RENAME TO "CategoryTemplateAgeGroup_rulesetId_code_key";

-- RenameIndex
ALTER INDEX "CategoryTemplateAgeGroup_categoryTemplateId_idx" RENAME TO "CategoryTemplateAgeGroup_rulesetId_idx";
