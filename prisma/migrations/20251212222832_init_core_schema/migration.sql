-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('SITE_AUDIT', 'PERFORMANCE', 'SCREENSHOTS', 'SPELLING');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TestScope" AS ENUM ('SINGLE_URL', 'CUSTOM_URLS', 'SITEMAP');

-- CreateEnum
CREATE TYPE "IssueProvider" AS ENUM ('SE_RANKING', 'LANGUAGETOOL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScreenshotRole" AS ENUM ('CURRENT', 'PREVIOUS', 'BASELINE');

-- CreateEnum
CREATE TYPE "ManualTestType" AS ENUM ('SCREENSHOTS', 'SPELLING');

-- CreateEnum
CREATE TYPE "ManualStatusLabel" AS ENUM ('PASS', 'REVIEW', 'FAIL');

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID,
    "name" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "sitemapUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "supabaseUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "type" "TestType" NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'QUEUED',
    "score" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "rawPayload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRunConfig" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRunId" UUID NOT NULL,
    "scope" "TestScope" NOT NULL,
    "urls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRunConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrlResult" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRunId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "lcp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "inp" DOUBLE PRECISION,
    "fcp" DOUBLE PRECISION,
    "tbt" DOUBLE PRECISION,
    "tti" DOUBLE PRECISION,
    "performanceScore" INTEGER,
    "accessibilityScore" INTEGER,
    "issueCount" INTEGER,
    "criticalIssues" INTEGER,
    "viewport" TEXT,
    "additionalMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRunId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "provider" "IssueProvider" NOT NULL,
    "code" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenshotSet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "testRunId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "role" "ScreenshotRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenshotSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTestStatus" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "testType" "ManualTestType" NOT NULL,
    "statusLabel" "ManualStatusLabel" NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTestStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_siteUrl_idx" ON "Project"("siteUrl");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabaseUserId_idx" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_type_createdAt_idx" ON "TestRun"("projectId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "TestRun_status_createdAt_idx" ON "TestRun"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestRunConfig_testRunId_key" ON "TestRunConfig"("testRunId");

-- CreateIndex
CREATE INDEX "TestRunConfig_testRunId_idx" ON "TestRunConfig"("testRunId");

-- CreateIndex
CREATE INDEX "UrlResult_testRunId_idx" ON "UrlResult"("testRunId");

-- CreateIndex
CREATE INDEX "UrlResult_url_idx" ON "UrlResult"("url");

-- CreateIndex
CREATE INDEX "UrlResult_performanceScore_idx" ON "UrlResult"("performanceScore");

-- CreateIndex
CREATE INDEX "Issue_testRunId_idx" ON "Issue"("testRunId");

-- CreateIndex
CREATE INDEX "Issue_provider_idx" ON "Issue"("provider");

-- CreateIndex
CREATE INDEX "Issue_severity_idx" ON "Issue"("severity");

-- CreateIndex
CREATE INDEX "Issue_url_idx" ON "Issue"("url");

-- CreateIndex
CREATE INDEX "ScreenshotSet_projectId_idx" ON "ScreenshotSet"("projectId");

-- CreateIndex
CREATE INDEX "ScreenshotSet_testRunId_idx" ON "ScreenshotSet"("testRunId");

-- CreateIndex
CREATE INDEX "ScreenshotSet_url_idx" ON "ScreenshotSet"("url");

-- CreateIndex
CREATE INDEX "ScreenshotSet_role_idx" ON "ScreenshotSet"("role");

-- CreateIndex
CREATE INDEX "ManualTestStatus_projectId_testType_idx" ON "ManualTestStatus"("projectId", "testType");

-- CreateIndex
CREATE INDEX "ManualTestStatus_updatedByUserId_idx" ON "ManualTestStatus"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunConfig" ADD CONSTRAINT "TestRunConfig_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlResult" ADD CONSTRAINT "UrlResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotSet" ADD CONSTRAINT "ScreenshotSet_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotSet" ADD CONSTRAINT "ScreenshotSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
