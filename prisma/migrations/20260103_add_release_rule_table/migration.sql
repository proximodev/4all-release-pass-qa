-- CreateTable
CREATE TABLE "ReleaseRule" (
    "code" TEXT NOT NULL,
    "provider" "IssueProvider" NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "impact" TEXT,
    "fix" TEXT,
    "docUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseRule_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "ReleaseRule_provider_idx" ON "ReleaseRule"("provider");

-- CreateIndex
CREATE INDEX "ReleaseRule_category_idx" ON "ReleaseRule"("category");

-- CreateIndex
CREATE INDEX "ReleaseRule_isActive_idx" ON "ReleaseRule"("isActive");
