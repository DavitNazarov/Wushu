DO $$
BEGIN
  IF to_regclass('"Ruleset"') IS NOT NULL
     AND to_regclass('"CategoryTemplate"') IS NULL THEN
    ALTER TABLE "Ruleset" RENAME TO "CategoryTemplate";
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"RulesetAgeGroup"') IS NOT NULL
     AND to_regclass('"CategoryTemplateAgeGroup"') IS NULL THEN
    ALTER TABLE "RulesetAgeGroup" RENAME TO "CategoryTemplateAgeGroup";
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('"RulesetWeightCategory"') IS NOT NULL
     AND to_regclass('"CategoryTemplateWeight"') IS NULL THEN
    ALTER TABLE "RulesetWeightCategory" RENAME TO "CategoryTemplateWeight";
  END IF;
END
$$;

ALTER INDEX IF EXISTS "Ruleset_organisationId_name_version_key"
  RENAME TO "CategoryTemplate_organisationId_name_version_key";

ALTER INDEX IF EXISTS "RulesetAgeGroup_rulesetId_idx"
  RENAME TO "CategoryTemplateAgeGroup_categoryTemplateId_idx";

ALTER INDEX IF EXISTS "RulesetAgeGroup_rulesetId_code_key"
  RENAME TO "CategoryTemplateAgeGroup_categoryTemplateId_code_key";

ALTER INDEX IF EXISTS "RulesetWeightCategory_ageGroupId_idx"
  RENAME TO "CategoryTemplateWeight_ageGroupId_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ruleset_pkey'
  ) THEN
    ALTER TABLE "CategoryTemplate"
      RENAME CONSTRAINT "Ruleset_pkey" TO "CategoryTemplate_pkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Ruleset_organisationId_fkey'
  ) THEN
    ALTER TABLE "CategoryTemplate"
      RENAME CONSTRAINT "Ruleset_organisationId_fkey"
      TO "CategoryTemplate_organisationId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RulesetAgeGroup_pkey'
  ) THEN
    ALTER TABLE "CategoryTemplateAgeGroup"
      RENAME CONSTRAINT "RulesetAgeGroup_pkey"
      TO "CategoryTemplateAgeGroup_pkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RulesetAgeGroup_rulesetId_fkey'
  ) THEN
    ALTER TABLE "CategoryTemplateAgeGroup"
      RENAME CONSTRAINT "RulesetAgeGroup_rulesetId_fkey"
      TO "CategoryTemplateAgeGroup_categoryTemplateId_fkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RulesetWeightCategory_pkey'
  ) THEN
    ALTER TABLE "CategoryTemplateWeight"
      RENAME CONSTRAINT "RulesetWeightCategory_pkey"
      TO "CategoryTemplateWeight_pkey";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RulesetWeightCategory_ageGroupId_fkey'
  ) THEN
    ALTER TABLE "CategoryTemplateWeight"
      RENAME CONSTRAINT "RulesetWeightCategory_ageGroupId_fkey"
      TO "CategoryTemplateWeight_ageGroupId_fkey";
  END IF;
END
$$;
