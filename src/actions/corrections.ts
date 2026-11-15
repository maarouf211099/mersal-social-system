"use server";

import { prisma } from "@/lib/prisma";
import { dateOf, fail, num, run, str, type State } from "@/lib/action";
import { AUTO_OPS } from "@/lib/constants";
import { logAudit, logOp } from "@/lib/ops";
import { fmtMonth, isMonth, spanMonths } from "@/lib/months";
import { isoDate, money } from "@/lib/format";

// تصحيح أخطاء الإدخال — للمشرف والمدير فقط، بسبب إلزامي، والقيمة القديمة والجديدة في سجل التدقيق

/** تصحيح قيمة أو نهاية خدمة في قرار. الشهور اللي اتصرفت لا تتغير؛ التصحيح يسري على غير المرسل فقط */
export async function correctLine(_p: State, f: FormData): Promise<State> {
  return run("approve", async (u) => {
    const id = str(f, "lineId"), reason = str(f, "reason"), endMonth = str(f, "endMonth");
    const amount = num(f, "amount");
    if (!reason) fail("اكتب سبب التصحيح.");
    if (!(amount >= 0)) fail("اكتب القيمة.");
    if (!isMonth(endMonth)) fail("اختار شهر النهاية.");
    const l = await prisma.decisionLine.findUniqueOrThrow({ where: { id }, include: { decision: true, service: true } });
    if (l.decision.status !== "active") fail("التصحيح متاح للقرارات المستمرة فقط.");
    if (endMonth < l.startMonth) fail("شهر النهاية قبل البداية.");
    const lastSent = await prisma.entitlement.findFirst({ where: { lineId: id, OR: [{ sentAt: { not: null } }, { legacySent: true }] }, orderBy: { month: "desc" } });
    if (lastSent && endMonth < lastSent.month) fail(`لا يمكن إنهاء الخدمة قبل ${fmtMonth(lastSent.month)} لأنه اتصرف بالفعل.`);
    if (endMonth > l.endMonth) {
      const clash = await prisma.decisionLine.findFirst({ where: { id: { not: id }, caseCode: l.caseCode, serviceId: l.serviceId, beneficiary: l.beneficiary, decision: { status: "active" }, startMonth: { lte: endMonth }, endMonth: { gte: l.startMonth } }, include: { decision: true } });
      if (clash) fail(`التمديد يتعارض مع قرار ${clash.decision.no} لنفس الخدمة.`);
    }
    const old = { amount: Number(l.amount), endMonth: l.endMonth };
    if (old.amount === amount && old.endMonth === endMonth) fail("لا يوجد تغيير.");
    await prisma.$transaction(async (tx) => {
      await tx.decisionLine.update({ where: { id }, data: { amount, endMonth, months: spanMonths(l.startMonth, endMonth) } });
      const unsent = await tx.entitlement.findMany({ where: { lineId: id, sentAt: null, legacySent: false, stoppedAt: null } });
      for (const e of unsent) {
        if (e.month > endMonth) {
          await tx.entitlement.update({ where: { id: e.id }, data: { stoppedAt: new Date(), stoppedReason: `تصحيح مدة القرار: ${reason}` } });
          await tx.task.updateMany({ where: { entitlementId: e.id, status: { in: ["new", "in_progress", "stuck"] } }, data: { status: "cancelled", result: "أُلغيت: تصحيح مدة القرار" } });
        } else if (old.amount !== amount) {
          await tx.entitlement.update({ where: { id: e.id }, data: { baseAmount: amount, amount: amount + Number(e.carriedAmount) } });
        }
      }
      await logOp(tx, u.id, AUTO_OPS.correction, { caseCode: l.caseCode, result: `قرار ${l.decision.no} · ${l.service.name}: ${money(old.amount)}→${money(amount)} ج · ${fmtMonth(old.endMonth)}→${fmtMonth(endMonth)}`, notes: reason, ref: id });
      await logAudit(tx, u.id, "line_corrected", l.caseCode, { decision: l.decision.no, service: l.service.name, old, new: { amount, endMonth }, reason });
    });
    return "تم التصحيح. الشهور اللي اتصرفت زي ما هي، والتصحيح سرى على اللي لسه ما اتبعتش.";
  });
}

/** تصحيح بيانات القرار نفسه (الرقم، المتبرع، النص) */
export async function correctDecision(_p: State, f: FormData): Promise<State> {
  return run("approve", async (u) => {
    const id = str(f, "id"), reason = str(f, "reason"), no = str(f, "no");
    if (!reason) fail("اكتب سبب التصحيح.");
    if (!no) fail("رقم القرار مطلوب.");
    const d = await prisma.decision.findUniqueOrThrow({ where: { id } });
    if (no !== d.no && (await prisma.decision.findUnique({ where: { no } }))) fail(`رقم القرار ${no} مسجل من قبل.`);
    const issue = dateOf(str(f, "issueDate")) ?? d.issueDate;
    const nw = { no, donor: str(f, "donor"), text: str(f, "text"), issueDate: issue };
    await prisma.$transaction(async (tx) => {
      await tx.decision.update({ where: { id }, data: nw });
      await logAudit(tx, u.id, "decision_corrected", d.caseCode, { old: { no: d.no, donor: d.donor, text: d.text, issueDate: isoDate(d.issueDate) }, new: { ...nw, issueDate: isoDate(issue) }, reason });
    });
    return "تم تصحيح بيانات القرار.";
  });
}

/** تصحيح تحويل مسجل غلط (المبلغ / الطريقة / التاريخ / المرجع) — التحويل نفسه لا يُحذف */
export async function correctTransfer(_p: State, f: FormData): Promise<State> {
  return run("approve", async (u) => {
    const entId = str(f, "entId"), reason = str(f, "reason"), method = str(f, "method"), ref = str(f, "ref");
    const amount = num(f, "amount"), date = dateOf(str(f, "date"));
    if (!reason) fail("اكتب سبب التصحيح.");
    if (!(amount > 0) || !method || !date || !ref) fail("المبلغ والطريقة والتاريخ والمرجع إلزامية.");
    const t = await prisma.transfer.findUniqueOrThrow({ where: { entitlementId: entId }, include: { entitlement: { include: { refunds: true } } } });
    const refunded = t.entitlement.refunds.reduce((s, r) => s + Number(r.amount), 0);
    if (amount < refunded) fail(`المبلغ أقل من المسترد بالفعل (${money(refunded)} ج).`);
    const clash = await prisma.transfer.findFirst({ where: { ref, id: { not: t.id }, batchRef: false }, include: { entitlement: true } });
    if (clash && !t.batchRef) fail(`المرجع ${ref} مستخدم للحالة ${clash.entitlement.caseCode}.`);
    const old = { amount: Number(t.amount), method: t.method, date: isoDate(t.date), ref: t.ref };
    await prisma.$transaction(async (tx) => {
      await tx.transfer.update({ where: { id: t.id }, data: { amount, method, date: date!, ref } });
      await logOp(tx, u.id, AUTO_OPS.correction, { caseCode: t.entitlement.caseCode, result: `تحويل ${fmtMonth(t.entitlement.month)}: ${money(old.amount)}→${money(amount)} ج · ${old.ref}→${ref}`, notes: reason, ref: entId });
      await logAudit(tx, u.id, "transfer_corrected", t.entitlement.caseCode, { month: t.entitlement.month, old, new: { amount, method, date: isoDate(date), ref }, reason });
    });
    return "تم تصحيح التحويل، والقيمة القديمة محفوظة في سجل التدقيق.";
  });
}

/** علامة «تحتاج لتبرع» على القرار — تتشال لما يتلاقى متبرع */
export async function setNeedsDonation(_p: State, f: FormData): Promise<State> {
  return run("approve", async (u) => {
    const id = str(f, "id"), on = str(f, "on") === "1", note = str(f, "note");
    const d = await prisma.decision.update({ where: { id }, data: { needsDonation: on, ...(note && !on ? { donor: note } : {}) } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "donation_flag", target: d.caseCode, meta: { no: d.no, needsDonation: on, donor: note || undefined } } });
    return on ? "اتسجل القرار «تحتاج لتبرع»." : "اتشالت علامة «تحتاج لتبرع».";
  });
}
