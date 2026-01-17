-- AlterTable
ALTER TABLE "ReleaseRule" ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReleaseRun" ADD COLUMN     "enabledOptionalRules" JSONB;

-- CreateTable
CREATE TABLE "ProjectOptionalRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOptionalRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectOptionalRule_projectId_idx" ON "ProjectOptionalRule"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOptionalRule_projectId_ruleCode_key" ON "ProjectOptionalRule"("projectId", "ruleCode");

-- CreateIndex
CREATE INDEX "ReleaseRule_isOptional_idx" ON "ReleaseRule"("isOptional");

-- AddForeignKey
ALTER TABLE "ProjectOptionalRule" ADD CONSTRAINT "ProjectOptionalRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
