-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyId" UUID;

-- CreateIndex
CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

-- CreateIndex
CREATE INDEX "Company_isSystem_idx" ON "Company"("isSystem");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
