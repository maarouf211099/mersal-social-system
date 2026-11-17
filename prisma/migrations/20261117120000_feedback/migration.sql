-- تقييم النظام: جدول جديد للردود — إضافة بس، مفيش أي تعديل على جدول موجود
-- رد واحد لكل مستخدم في كل حملة (campaign)، والدرجات من 1 لـ 5

-- CreateTable
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "ease" INTEGER,
    "speed" INTEGER,
    "value" INTEGER,
    "problems" TEXT NOT NULL DEFAULT '',
    "ideas" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
    -- القاعدة نفسها بتمنع درجات برة 1..5 ونصوص أطول من المسموح
    CONSTRAINT feedback_scores_valid CHECK (
      "overall" BETWEEN 1 AND 5
      AND ("ease" IS NULL OR "ease" BETWEEN 1 AND 5)
      AND ("speed" IS NULL OR "speed" BETWEEN 1 AND 5)
      AND ("value" IS NULL OR "value" BETWEEN 1 AND 5)
    ),
    CONSTRAINT feedback_text_valid CHECK (
      char_length(btrim("department")) BETWEEN 1 AND 120
      AND ("name" IS NULL OR char_length("name") <= 120)
      AND char_length("problems") <= 2000
      AND char_length("ideas") <= 2000
    )
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Feedback_campaign_createdAt_idx" ON "Feedback"("campaign", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Feedback_campaign_userId_key" ON "Feedback"("campaign", "userId");
