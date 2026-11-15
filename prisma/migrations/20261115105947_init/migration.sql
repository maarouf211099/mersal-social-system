-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'supervisor', 'finance', 'staff', 'viewer');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('financial', 'card', 'in_kind', 'service');

-- CreateEnum
CREATE TYPE "ServiceCycle" AS ENUM ('monthly', 'once', 'coverage');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('active', 'stopped', 'withdrawn', 'ended');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('none', 'sent', 'renewed', 'not_renewed');

-- CreateEnum
CREATE TYPE "FollowResult" AS ENUM ('none', 'received', 'not_received', 'no_answer');

-- CreateEnum
CREATE TYPE "SettleHow" AS ENUM ('carry', 'extend', 'drop');

-- CreateEnum
CREATE TYPE "AttemptKind" AS ENUM ('confirm', 'follow');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('full', 'partial');

-- CreateEnum
CREATE TYPE "Settlement" AS ENUM ('pending', 'settled');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('confirm', 'follow', 'action', 'manual');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('new', 'in_progress', 'done', 'stuck', 'cancelled');

-- CreateEnum
CREATE TYPE "OpStatus" AS ENUM ('new', 'in_progress', 'done');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'staff',
    "team" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE,
    "gender" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '',
    "familySize" INTEGER,
    "governorate" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "phone2" TEXT NOT NULL DEFAULT '',
    "unhcr" TEXT NOT NULL DEFAULT '',
    "recvMethod" TEXT NOT NULL DEFAULT '',
    "recvName" TEXT NOT NULL DEFAULT '',
    "recvPhone" TEXT NOT NULL DEFAULT '',
    "recvIdNo" TEXT NOT NULL DEFAULT '',
    "recvBranch" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "dataConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CaseChange" (
    "id" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "diffs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "cycle" "ServiceCycle" NOT NULL,
    "needsFollow" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "donor" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "status" "DecisionStatus" NOT NULL DEFAULT 'active',
    "stopReason" TEXT NOT NULL DEFAULT '',
    "stoppedAt" TIMESTAMP(3),
    "stoppedById" TEXT,
    "overrideNote" TEXT NOT NULL DEFAULT '',
    "renewOfId" TEXT,
    "renewalStatus" "RenewalStatus" NOT NULL DEFAULT 'none',
    "renewalAt" TIMESTAMP(3),
    "renewalById" TEXT,
    "renewalNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLine" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "months" INTEGER NOT NULL,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT NOT NULL,
    "mismatchNote" TEXT NOT NULL DEFAULT '',
    "extendedBy" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DecisionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "count" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "needsConfirm" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmNote" TEXT NOT NULL DEFAULT '',
    "holdApprovedAt" TIMESTAMP(3),
    "holdApprovedById" TEXT,
    "holdApprovedReason" TEXT NOT NULL DEFAULT '',
    "holdApprovedHow" "SettleHow",
    "carriedFromId" TEXT,
    "carriedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "batchId" TEXT,
    "followResult" "FollowResult" NOT NULL DEFAULT 'none',
    "followAt" TIMESTAMP(3),
    "followById" TEXT,
    "notPaidReason" TEXT NOT NULL DEFAULT '',
    "notPaidAction" TEXT NOT NULL DEFAULT '',
    "stuckReason" TEXT NOT NULL DEFAULT '',
    "stuckAt" TIMESTAMP(3),
    "stuckById" TEXT,
    "stoppedAt" TIMESTAMP(3),
    "stoppedReason" TEXT NOT NULL DEFAULT '',
    "settledHow" "SettleHow",
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "settledNote" TEXT NOT NULL DEFAULT '',
    "legacySent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ref" TEXT NOT NULL,
    "batchRef" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactAttempt" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "kind" "AttemptKind" NOT NULL,
    "answered" BOOLEAN NOT NULL,
    "result" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "transferAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT '',
    "type" "RefundType" NOT NULL,
    "settlement" "Settlement" NOT NULL DEFAULT 'pending',
    "how" "SettleHow",
    "note" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "kind" "TaskKind" NOT NULL,
    "title" TEXT NOT NULL,
    "opType" TEXT NOT NULL DEFAULT '',
    "caseCode" TEXT,
    "entitlementId" TEXT,
    "assigneeId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'new',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "returnedCount" INTEGER NOT NULL DEFAULT 0,
    "returnNote" TEXT NOT NULL DEFAULT '',
    "returnedToId" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL,
    "scope" TEXT NOT NULL,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OpType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL,
    "caseCode" TEXT,
    "dept" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "status" "OpStatus" NOT NULL DEFAULT 'done',
    "result" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "attachment" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 1,
    "ref" TEXT NOT NULL DEFAULT '',
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedCount" INTEGER NOT NULL DEFAULT 0,
    "returnNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoJti" (
    "jti" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoJti_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Case_name_idx" ON "Case"("name");

-- CreateIndex
CREATE INDEX "Case_phone_idx" ON "Case"("phone");

-- CreateIndex
CREATE INDEX "CaseChange_caseCode_createdAt_idx" ON "CaseChange"("caseCode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_no_key" ON "Decision"("no");

-- CreateIndex
CREATE INDEX "Decision_caseCode_idx" ON "Decision"("caseCode");

-- CreateIndex
CREATE INDEX "Decision_status_idx" ON "Decision"("status");

-- CreateIndex
CREATE INDEX "DecisionLine_caseCode_idx" ON "DecisionLine"("caseCode");

-- CreateIndex
CREATE INDEX "DecisionLine_startMonth_endMonth_idx" ON "DecisionLine"("startMonth", "endMonth");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_code_key" ON "PaymentBatch"("code");

-- CreateIndex
CREATE INDEX "Entitlement_month_idx" ON "Entitlement"("month");

-- CreateIndex
CREATE INDEX "Entitlement_caseCode_idx" ON "Entitlement"("caseCode");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_lineId_month_key" ON "Entitlement"("lineId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_entitlementId_key" ON "Transfer"("entitlementId");

-- CreateIndex
CREATE INDEX "Transfer_ref_idx" ON "Transfer"("ref");

-- CreateIndex
CREATE INDEX "ContactAttempt_entitlementId_kind_idx" ON "ContactAttempt"("entitlementId", "kind");

-- CreateIndex
CREATE INDEX "Refund_month_idx" ON "Refund"("month");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_idx" ON "Task"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE INDEX "Task_completedById_completedAt_idx" ON "Task"("completedById", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Task_kind_entitlementId_key" ON "Task"("kind", "entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "OpType_name_key" ON "OpType"("name");

-- CreateIndex
CREATE INDEX "Operation_date_idx" ON "Operation"("date");

-- CreateIndex
CREATE INDEX "Operation_userId_date_idx" ON "Operation"("userId", "date");

-- CreateIndex
CREATE INDEX "Operation_caseCode_idx" ON "Operation"("caseCode");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "CaseChange" ADD CONSTRAINT "CaseChange_caseCode_fkey" FOREIGN KEY ("caseCode") REFERENCES "Case"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_caseCode_fkey" FOREIGN KEY ("caseCode") REFERENCES "Case"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLine" ADD CONSTRAINT "DecisionLine_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLine" ADD CONSTRAINT "DecisionLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "DecisionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_caseCode_fkey" FOREIGN KEY ("caseCode") REFERENCES "Case"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactAttempt" ADD CONSTRAINT "ContactAttempt_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_caseCode_fkey" FOREIGN KEY ("caseCode") REFERENCES "Case"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────────── حماية السجلات على مستوى قاعدة البيانات ─────────────
-- سجل التدقيق: لا تعديل ولا حذف
CREATE OR REPLACE FUNCTION social_forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'السجل % محمي: لا يمكن التعديل أو الحذف', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION social_forbid_change();

-- التحويلات والاستردادات ومحاولات الاتصال وتعديلات بيانات الحالات: لا حذف
CREATE TRIGGER transfer_no_delete BEFORE DELETE ON "Transfer" FOR EACH ROW EXECUTE FUNCTION social_forbid_change();
CREATE TRIGGER refund_no_delete BEFORE DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION social_forbid_change();
CREATE TRIGGER attempt_no_delete BEFORE DELETE ON "ContactAttempt" FOR EACH ROW EXECUTE FUNCTION social_forbid_change();
CREATE TRIGGER case_change_append_only BEFORE UPDATE OR DELETE ON "CaseChange" FOR EACH ROW EXECUTE FUNCTION social_forbid_change();

-- قيم المبالغ لا تكون سالبة
ALTER TABLE "Entitlement" ADD CONSTRAINT entitlement_amount_nonneg CHECK ("amount" >= 0 AND "baseAmount" >= 0);
ALTER TABLE "Transfer" ADD CONSTRAINT transfer_amount_pos CHECK ("amount" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT refund_amount_pos CHECK ("amount" > 0 AND "amount" <= "transferAmount");
ALTER TABLE "DecisionLine" ADD CONSTRAINT line_months_valid CHECK ("months" >= 1 AND "startMonth" <= "endMonth");
