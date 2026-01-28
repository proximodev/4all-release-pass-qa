-- Migration: Convert DictionaryWord.status enum to isActive boolean
-- Also removes SEED from DictionaryWordSource enum

-- Step 1: Add isActive column with default true
ALTER TABLE "DictionaryWord" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Step 2: Convert existing data
-- WHITELISTED -> true (already default)
-- REVIEW -> false
UPDATE "DictionaryWord" SET "isActive" = false WHERE "status" = 'REVIEW';

-- Step 3: Drop the index on status
DROP INDEX IF EXISTS "DictionaryWord_status_idx";

-- Step 4: Drop the status column
ALTER TABLE "DictionaryWord" DROP COLUMN "status";

-- Step 5: Create index on isActive
CREATE INDEX "DictionaryWord_isActive_idx" ON "DictionaryWord"("isActive");

-- Step 6: Update any SEED source values to MANUAL (before removing from enum)
UPDATE "DictionaryWord" SET "source" = 'MANUAL' WHERE "source" = 'SEED';

-- Step 7: Drop the default on source column before changing enum type
ALTER TABLE "DictionaryWord" ALTER COLUMN "source" DROP DEFAULT;

-- Step 8: Create new enum without SEED
CREATE TYPE "DictionaryWordSource_new" AS ENUM ('MANUAL', 'RESULT');

-- Step 9: Alter column to use new enum
ALTER TABLE "DictionaryWord"
  ALTER COLUMN "source" TYPE "DictionaryWordSource_new"
  USING ("source"::text::"DictionaryWordSource_new");

-- Step 10: Drop old enum and rename new one
DROP TYPE "DictionaryWordSource";
ALTER TYPE "DictionaryWordSource_new" RENAME TO "DictionaryWordSource";

-- Step 11: Restore the default on source column
ALTER TABLE "DictionaryWord" ALTER COLUMN "source" SET DEFAULT 'MANUAL'::"DictionaryWordSource";

-- Step 12: Drop the DictionaryWordStatus enum (no longer needed)
DROP TYPE "DictionaryWordStatus";
