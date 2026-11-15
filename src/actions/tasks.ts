"use server";

import { prisma } from "@/lib/prisma";
import { addDays, dateOf, fail, num, run, str, strs, type State } from "@/lib/action";
import { AUTO_OPS, TASK_STATUS_LABELS } from "@/lib/constants";
import { logAudit, logOp } from "@/lib/ops";
import { getSettings } from "@/lib/settings";
import { can } from "@/lib/perms";
import { storeUpload } from "@/lib/files";

export async function createTask(_p: State, f: FormData): Promise<State> {
  return run("task", async (u) => {
    const st = await getSettings();
    const title = str(f, "title"), code = str(f, "caseCode"), assignee = str(f, "assigneeId");
    if (!title) fail("اكتب عنوان المهمة.");
    if (code && !(await prisma.case.findUnique({ where: { code } }))) fail("كود الحالة غير مسجل.");
    if (assignee && assignee !== u.id && !can(u.role, "assign")) fail("إسناد المهام لغيرك متاح للمشرف فقط.");
    const dueAt = dateOf(str(f, "due")) ?? addDays(new Date(), st.taskDays);
    await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({ data: { kind: "manual", title, opType: str(f, "opType"), caseCode: code || null, assigneeId: assignee || null, dueAt, notes: str(f, "notes"), createdById: u.id } });
      await logAudit(tx, u.id, "task_created", code || title, { id: t.id, assignee });
    });
    return "تم إنشاء المهمة.";
  });
}

export async function updateTaskStatus(_p: State, f: FormData): Promise<State> {
  return run("task", async (u) => {
    const id = str(f, "id"), status = str(f, "status") as "in_progress" | "done" | "stuck", result = str(f, "result");
    const t = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (t.kind !== "manual") fail("هذه المهمة تُنفذ من شاشتها في دورة العمل.");
    if (t.assigneeId && t.assigneeId !== u.id && !can(u.role, "assign")) fail("المهمة مسندة لموظف آخر.");
    if (status === "done" && !result) fail("لا يمكن إغلاق المهمة بدون تسجيل نتيجة التنفيذ.");
    if (status === "stuck" && !result) fail("اكتب سبب التعثر.");
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: {
        status, result: result || t.result,
        ...(status === "in_progress" ? { startedAt: t.startedAt ?? new Date() } : {}),
        ...(status === "done" ? { completedAt: new Date(), completedById: u.id } : {}),
      } });
      if (status === "done") await logOp(tx, u.id, t.opType || AUTO_OPS.manualTask, { caseCode: t.caseCode, dept: t.caseCode ? "" : t.title, result, ref: id });
      await logAudit(tx, u.id, "task_status", t.caseCode || t.title, { status, result });
    });
    return `تم: ${TASK_STATUS_LABELS[status]}.`;
  });
}

export async function assignTasks(_p: State, f: FormData): Promise<State> {
  return run("assign", async (u) => {
    const ids = strs(f, "ids"), to = str(f, "to");
    if (!ids.length) fail("حدد مهمة واحدة على الأقل.");
    if (!to) fail("اختار الموظف.");
    const user = await prisma.user.findUnique({ where: { id: to } });
    if (!user || !user.isActive) fail("الموظف غير موجود أو موقوف.");
    const r = await prisma.task.updateMany({ where: { id: { in: ids }, status: { in: ["new", "in_progress", "stuck"] } }, data: { assigneeId: to } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "tasks_assigned", target: user!.name, meta: { count: r.count } } });
    return `أُسندت ${r.count} مهمة إلى ${user!.name}.`;
  });
}

/** إرجاع للتصحيح (مشرف): يعيد فتح المهمة ويُحسب على من نفّذها */
export async function returnTask(_p: State, f: FormData): Promise<State> {
  return run("return", async (u) => {
    const id = str(f, "id"), note = str(f, "note");
    if (!note) fail("اكتب سبب الإرجاع للتصحيح.");
    const t = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (t.status !== "done") fail("يمكن إرجاع المهام المكتملة فقط.");
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id }, data: { status: "in_progress", completedAt: null, completedById: null, returnedCount: { increment: 1 }, returnNote: note, returnedToId: t.completedById } });
      if (t.entitlementId && t.kind === "confirm") {
        await tx.entitlement.updateMany({ where: { caseCode: t.caseCode!, needsConfirm: true, sentAt: null }, data: { confirmedAt: null, confirmedById: null } });
        await tx.case.update({ where: { code: t.caseCode! }, data: { dataConfirmed: false } });
      }
      if (t.entitlementId && t.kind === "follow") {
        await tx.contactAttempt.updateMany({ where: { entitlementId: t.entitlementId, kind: "follow" }, data: { voided: true } });
        await tx.entitlement.update({ where: { id: t.entitlementId }, data: { followResult: "none", followAt: null, followById: null, notPaidReason: "", notPaidAction: "" } });
        await tx.task.updateMany({ where: { kind: "action", entitlementId: t.entitlementId, status: { in: ["new", "in_progress"] } }, data: { status: "cancelled", result: "أُلغيت: إرجاع المتابعة للتصحيح" } });
      }
      await logAudit(tx, u.id, "task_returned", t.caseCode || t.title, { note, to: t.completedById });
    });
    return "أُرجعت المهمة للتصحيح.";
  });
}

// ───────────── العمليات ─────────────
export async function createOperation(_p: State, f: FormData): Promise<State> {
  return run("op", async (u) => {
    const typeId = str(f, "typeId");
    const t = await prisma.opType.findUnique({ where: { id: typeId } });
    if (!t) fail("اختار نوع العملية.");
    const code = str(f, "caseCode"), dept = str(f, "dept"), status = (str(f, "status") || "done") as "new" | "in_progress" | "done", result = str(f, "result");
    if (t!.scope === "case" && !(code && (await prisma.case.findUnique({ where: { code } })))) fail("اكتب كود حالة مسجل لهذه العملية.");
    if (t!.scope === "general" && !dept) fail("اكتب الجهة أو الإدارة.");
    if (status === "done" && !result) fail("اكتب نتيجة العملية قبل تسجيلها كمكتملة.");
    const date = dateOf(str(f, "date")) ?? new Date();
    const count = Math.max(1, Math.floor(num(f, "count") || 1));
    await prisma.$transaction(async (tx) => {
      const op = await tx.operation.create({ data: { type: t!.name, team: t!.team, weight: t!.weight, caseCode: t!.scope === "case" ? code : null, dept: t!.scope === "general" ? dept : "", date, status, result, notes: str(f, "notes"), attachment: str(f, "attachment"), count, auto: false, userId: u.id } });
      await storeUpload(tx, f.get("file"), { caseCode: t!.scope === "case" ? code : null, operationId: op.id }, u.id);
      await logAudit(tx, u.id, "operation", t!.scope === "case" ? code : dept, { type: t!.name, count });
    });
    return "تم تسجيل العملية باسمك ووقت التسجيل.";
  });
}

export async function setOperationStatus(_p: State, f: FormData): Promise<State> {
  return run("op", async (u) => {
    const id = str(f, "id"), status = str(f, "status") as "new" | "in_progress" | "done", result = str(f, "result");
    const o = await prisma.operation.findUniqueOrThrow({ where: { id } });
    if (o.userId !== u.id && !can(u.role, "return")) fail("تعديل عملية موظف آخر متاح للمشرف فقط.");
    if (status === "done" && !(result || o.result)) fail("اكتب النتيجة قبل الإغلاق.");
    await prisma.$transaction(async (tx) => {
      await tx.operation.update({ where: { id }, data: { status, result: result || o.result } });
      await logAudit(tx, u.id, "operation_status", o.caseCode || o.dept, { type: o.type, old: o.status, new: status });
    });
    return "تم التحديث.";
  });
}

export async function returnOperation(_p: State, f: FormData): Promise<State> {
  return run("return", async (u) => {
    const id = str(f, "id"), note = str(f, "note");
    if (!note) fail("اكتب سبب الإرجاع.");
    const o = await prisma.operation.update({ where: { id }, data: { returnedCount: { increment: 1 }, returnNote: note, status: "in_progress" } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "operation_returned", target: o.caseCode || o.dept, meta: { type: o.type, note, to: o.userId } } });
    return "أُرجعت العملية للتصحيح.";
  });
}
