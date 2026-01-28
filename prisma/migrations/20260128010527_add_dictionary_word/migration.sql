-- CreateEnum
CREATE TYPE "DictionaryWordStatus" AS ENUM ('REVIEW', 'WHITELISTED');

-- CreateEnum
CREATE TYPE "DictionaryWordSource" AS ENUM ('MANUAL', 'RESULT', 'SEED');

-- CreateTable
CREATE TABLE "DictionaryWord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "word" TEXT NOT NULL,
    "displayWord" TEXT NOT NULL,
    "status" "DictionaryWordStatus" NOT NULL DEFAULT 'REVIEW',
    "source" "DictionaryWordSource" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryWord_word_key" ON "DictionaryWord"("word");

-- CreateIndex
CREATE INDEX "DictionaryWord_status_idx" ON "DictionaryWord"("status");

-- CreateIndex
CREATE INDEX "DictionaryWord_word_idx" ON "DictionaryWord"("word");

-- AddForeignKey
ALTER TABLE "DictionaryWord" ADD CONSTRAINT "DictionaryWord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
