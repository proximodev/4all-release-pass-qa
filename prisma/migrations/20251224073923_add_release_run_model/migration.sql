/*
  Warnings:

  - Added the required column `impact` to the `Issue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `releaseRunId` to the `ManualTestStatus` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReleaseRunStatus" AS ENUM ('PENDING', 'READY', 'FAIL');

-- CreateEnum
CREATE TYPE "IssueImpact" AS ENUM ('BLOCKER', 'WARNING', 'INFO');

-- AlterEnum
ALTER TYPE "TestType" ADD VALUE 'PAGE_PREFLIGHT';

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "impact" "IssueImpact" NOT NULL;

-- AlterTable
ALTER TABLE "ManualTestStatus" ADD COLUMN     "releaseRunId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "releaseRunId" UUID;

-- CreateTable
CREATE TABLE "ReleaseRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "name" TEXT,
    "status" "ReleaseRunStatus" NOT NULL DEFAULT 'PENDING',
    "urls" JSONB NOT NULL,
    "selectedTests" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseRun_projectId_status_idx" ON "ReleaseRun"("projectId", "status");

-- CreateIndex
CREATE INDEX "ReleaseRun_createdAt_idx" ON "ReleaseRun"("createdAt");

-- CreateIndex
CREATE INDEX "Issue_impact_idx" ON "Issue"("impact");

-- CreateIndex
CREATE INDEX "ManualTestStatus_releaseRunId_idx" ON "ManualTestStatus"("releaseRunId");

-- CreateIndex
CREATE INDEX "TestRun_releaseRunId_idx" ON "TestRun"("releaseRunId");

-- AddForeignKey
ALTER TABLE "ReleaseRun" ADD CONSTRAINT "ReleaseRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_releaseRunId_fkey" FOREIGN KEY ("releaseRunId") REFERENCES "ReleaseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_releaseRunId_fkey" FOREIGN KEY ("releaseRunId") REFERENCES "ReleaseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
