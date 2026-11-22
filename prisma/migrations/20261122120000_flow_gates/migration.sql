-- غلق خدمة لوحدها من «قائمة الغلق»
ALTER TABLE "DecisionLine" ADD COLUMN "stoppedAt" TIMESTAMP(3),
ADD COLUMN "stoppedById" TEXT,
ADD COLUMN "stopReason" TEXT NOT NULL DEFAULT '';

-- أي خدمة بتتبعت بتنزل المتابعة
UPDATE "Service" SET "needsFollow" = true WHERE "needsFollow" = false;
