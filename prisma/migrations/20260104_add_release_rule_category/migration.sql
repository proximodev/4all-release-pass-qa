-- CreateTable: ReleaseRuleCategory
CREATE TABLE "ReleaseRuleCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseRuleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseRuleCategory_name_key" ON "ReleaseRuleCategory"("name");
CREATE INDEX "ReleaseRuleCategory_sortOrder_idx" ON "ReleaseRuleCategory"("sortOrder");
CREATE INDEX "ReleaseRuleCategory_isActive_idx" ON "ReleaseRuleCategory"("isActive");

-- Populate ReleaseRuleCategory from existing ReleaseRule.category values
INSERT INTO "ReleaseRuleCategory" ("name", "updatedAt")
SELECT DISTINCT "category", CURRENT_TIMESTAMP
FROM "ReleaseRule"
WHERE "category" IS NOT NULL;

-- Add categoryId column to ReleaseRule (nullable initially for migration)
ALTER TABLE "ReleaseRule" ADD COLUMN "categoryId" UUID;

-- Populate categoryId from existing category values
UPDATE "ReleaseRule" r
SET "categoryId" = c."id"
FROM "ReleaseRuleCategory" c
WHERE r."category" = c."name";

-- Make categoryId NOT NULL after population
ALTER TABLE "ReleaseRule" ALTER COLUMN "categoryId" SET NOT NULL;

-- Drop old category column and its index
DROP INDEX IF EXISTS "ReleaseRule_category_idx";
ALTER TABLE "ReleaseRule" DROP COLUMN "category";

-- Add FK constraint and index
ALTER TABLE "ReleaseRule" ADD CONSTRAINT "ReleaseRule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ReleaseRuleCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ReleaseRule_categoryId_idx" ON "ReleaseRule"("categoryId");
