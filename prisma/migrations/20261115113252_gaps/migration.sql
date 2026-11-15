-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "resendCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "caseCode" TEXT,
    "operationId" TEXT,
    "entitlementId" TEXT,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storedName" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");

-- CreateIndex
CREATE INDEX "Attachment_caseCode_idx" ON "Attachment"("caseCode");

-- CreateIndex
CREATE INDEX "Attachment_operationId_idx" ON "Attachment"("operationId");

-- CreateIndex
CREATE INDEX "Attachment_entitlementId_idx" ON "Attachment"("entitlementId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_caseCode_fkey" FOREIGN KEY ("caseCode") REFERENCES "Case"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- المرفقات لا تُحذف (توثيق)
CREATE TRIGGER attachment_no_delete BEFORE DELETE ON "Attachment" FOR EACH ROW EXECUTE FUNCTION social_forbid_change();
