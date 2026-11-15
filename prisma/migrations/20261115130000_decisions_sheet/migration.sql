-- بيانات شيت القرارات السنوي: حقول إضافية للحالة، المستفيد لكل خدمة، «تحتاج لتبرع»، ومفتاح منع تكرار الاستيراد

ALTER TABLE "Case" ADD COLUMN "age" INTEGER,
ADD COLUMN "religion" TEXT NOT NULL DEFAULT '',
ADD COLUMN "area" TEXT NOT NULL DEFAULT '',
ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN "residencyStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN "residencyExpiry" TEXT NOT NULL DEFAULT '',
ADD COLUMN "idExpiry" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Decision" ADD COLUMN "needsDonation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN "importKey" TEXT;

CREATE UNIQUE INDEX "Decision_importKey_key" ON "Decision"("importKey");

ALTER TABLE "DecisionLine" ADD COLUMN "beneficiary" TEXT NOT NULL DEFAULT '',
ADD COLUMN "category" TEXT NOT NULL DEFAULT '',
ADD COLUMN "note" TEXT NOT NULL DEFAULT '';
