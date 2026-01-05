-- CreateIndex
CREATE INDEX "ResultItem_code_idx" ON "ResultItem"("code");

-- Note: We intentionally do NOT add a database-level FK constraint here.
-- The relationship is defined in Prisma for ORM-level joins and queries,
-- but we allow ResultItem.code values that don't exist in ReleaseRule
-- (for provider codes that haven't been catalogued yet).
-- Prisma handles the optional relation (@relation) without requiring a DB constraint.
