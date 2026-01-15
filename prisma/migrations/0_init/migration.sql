-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('PAGE_PREFLIGHT', 'SITE_AUDIT', 'PERFORMANCE', 'SCREENSHOTS', 'SPELLING');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "TestScope" AS ENUM ('SINGLE_URL', 'CUSTOM_URLS', 'SITEMAP');

-- CreateEnum
CREATE TYPE "IssueProvider" AS ENUM ('SE_RANKING', 'LANGUAGETOOL', 'LIGHTHOUSE', 'LINKINATOR', 'ReleasePass', 'INTERNAL');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER');

-- CreateEnum
CREATE TYPE "ScreenshotRole" AS ENUM ('CURRENT', 'PREVIOUS', 'BASELINE');

-- CreateEnum
CREATE TYPE "ManualTestType" AS ENUM ('SCREENSHOTS', 'SPELLING');

-- CreateEnum
CREATE TYPE "ManualStatusLabel" AS ENUM ('PASS', 'REVIEW', 'FAIL');

-- CreateEnum
CREATE TYPE "ReleaseRunStatus" AS ENUM ('PENDING', 'READY', 'FAIL');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PASS', 'FAIL', 'SKIP');

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
    "deletedAt" TIMESTAMP(3),

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

-- CreateTable
CREATE TABLE "TestRun" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "releaseRunId" UUID,
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
    "score" INTEGER,
    "issueCount" INTEGER,
    "criticalIssues" INTEGER,
    "viewport" TEXT,
    "additionalMetrics" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UrlResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "urlResultId" UUID NOT NULL,
    "provider" "IssueProvider" NOT NULL,
    "code" TEXT NOT NULL,
    "releaseRuleCode" TEXT,
    "name" TEXT NOT NULL,
    "status" "ResultStatus" NOT NULL,
    "severity" "IssueSeverity",
    "meta" JSONB,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultItem_pkey" PRIMARY KEY ("id")
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
    "releaseRunId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "testType" "ManualTestType" NOT NULL,
    "statusLabel" "ManualStatusLabel" NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTestStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRuleCategory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseRuleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseRule" (
    "code" TEXT NOT NULL,
    "provider" "IssueProvider" NOT NULL,
    "categoryId" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "IgnoredRule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgnoredRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_siteUrl_idx" ON "Project"("siteUrl");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "User_supabaseUserId_idx" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "ReleaseRun_projectId_status_idx" ON "ReleaseRun"("projectId", "status");

-- CreateIndex
CREATE INDEX "ReleaseRun_createdAt_idx" ON "ReleaseRun"("createdAt");

-- CreateIndex
CREATE INDEX "TestRun_releaseRunId_idx" ON "TestRun"("releaseRunId");

-- CreateIndex
CREATE INDEX "TestRun_releaseRunId_type_idx" ON "TestRun"("releaseRunId", "type");

-- CreateIndex
CREATE INDEX "TestRun_releaseRunId_status_idx" ON "TestRun"("releaseRunId", "status");

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
CREATE INDEX "ResultItem_urlResultId_idx" ON "ResultItem"("urlResultId");

-- CreateIndex
CREATE INDEX "ResultItem_urlResultId_status_idx" ON "ResultItem"("urlResultId", "status");

-- CreateIndex
CREATE INDEX "ResultItem_provider_idx" ON "ResultItem"("provider");

-- CreateIndex
CREATE INDEX "ResultItem_status_idx" ON "ResultItem"("status");

-- CreateIndex
CREATE INDEX "ResultItem_severity_idx" ON "ResultItem"("severity");

-- CreateIndex
CREATE INDEX "ResultItem_code_idx" ON "ResultItem"("code");

-- CreateIndex
CREATE INDEX "ResultItem_releaseRuleCode_idx" ON "ResultItem"("releaseRuleCode");

-- CreateIndex
CREATE INDEX "ResultItem_ignored_idx" ON "ResultItem"("ignored");

-- CreateIndex
CREATE INDEX "ScreenshotSet_projectId_idx" ON "ScreenshotSet"("projectId");

-- CreateIndex
CREATE INDEX "ScreenshotSet_testRunId_idx" ON "ScreenshotSet"("testRunId");

-- CreateIndex
CREATE INDEX "ScreenshotSet_url_idx" ON "ScreenshotSet"("url");

-- CreateIndex
CREATE INDEX "ScreenshotSet_role_idx" ON "ScreenshotSet"("role");

-- CreateIndex
CREATE INDEX "ManualTestStatus_releaseRunId_idx" ON "ManualTestStatus"("releaseRunId");

-- CreateIndex
CREATE INDEX "ManualTestStatus_projectId_testType_idx" ON "ManualTestStatus"("projectId", "testType");

-- CreateIndex
CREATE INDEX "ManualTestStatus_updatedByUserId_idx" ON "ManualTestStatus"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseRuleCategory_name_key" ON "ReleaseRuleCategory"("name");

-- CreateIndex
CREATE INDEX "ReleaseRuleCategory_sortOrder_idx" ON "ReleaseRuleCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "ReleaseRuleCategory_isActive_idx" ON "ReleaseRuleCategory"("isActive");

-- CreateIndex
CREATE INDEX "ReleaseRule_provider_idx" ON "ReleaseRule"("provider");

-- CreateIndex
CREATE INDEX "ReleaseRule_categoryId_idx" ON "ReleaseRule"("categoryId");

-- CreateIndex
CREATE INDEX "ReleaseRule_isActive_idx" ON "ReleaseRule"("isActive");

-- CreateIndex
CREATE INDEX "IgnoredRule_projectId_url_idx" ON "IgnoredRule"("projectId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "IgnoredRule_projectId_url_code_key" ON "IgnoredRule"("projectId", "url", "code");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRun" ADD CONSTRAINT "ReleaseRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_releaseRunId_fkey" FOREIGN KEY ("releaseRunId") REFERENCES "ReleaseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRunConfig" ADD CONSTRAINT "TestRunConfig_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrlResult" ADD CONSTRAINT "UrlResult_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultItem" ADD CONSTRAINT "ResultItem_urlResultId_fkey" FOREIGN KEY ("urlResultId") REFERENCES "UrlResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultItem" ADD CONSTRAINT "ResultItem_releaseRuleCode_fkey" FOREIGN KEY ("releaseRuleCode") REFERENCES "ReleaseRule"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotSet" ADD CONSTRAINT "ScreenshotSet_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotSet" ADD CONSTRAINT "ScreenshotSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_releaseRunId_fkey" FOREIGN KEY ("releaseRunId") REFERENCES "ReleaseRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTestStatus" ADD CONSTRAINT "ManualTestStatus_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseRule" ADD CONSTRAINT "ReleaseRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ReleaseRuleCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgnoredRule" ADD CONSTRAINT "IgnoredRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

