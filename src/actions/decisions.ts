"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { fail, run, str, strs, dateOf, type State } from "@/lib/action";
import { AUTO_OPS, DEC_STATUS_LABELS } from "@/lib/constants";
import { logAudit, logOp } from "@/lib/ops";
import { currentMonth, fmtMonth, isMonth, spanMonths } from "@/lib/months";

async function nextDecisionNo(): Promise<string> {
  const rows = await prisma.decision.findMany({ select: { no: true } });
  let max = 0;
  for (const r of rows) { const m = r.no.match(/(\d+)$/); if (m) max = Math.max(max, Number(m[1])); }
  return `ق-${String(max + 1).padStart(2, "0")}`;
}

/** إضافة قرار (وتسجيل الحالة تلقائياً لو الكود جديد) — يمنع التعارض مع قرار ساري لنفس الخدمة */
export async function createDecision(_p: State, f: FormData): Promise<State> {
  let code = "";
  const r = await run("decision", async (u) => {
    code = str(f, "code");
    const name = str(f, "name");
    const issue = dateOf(str(f, "issueDate"));
    const override = str(f, "override");
    const renewOf = str(f, "renewOf");
    if (!code) fail("اكتب كود الحالة.");
    if (!issue) fail("اختار تاريخ القرار.");
    const existing = await prisma.case.findUnique({ where: { code } });
    if (!existing && !name) fail("الكود جديد: اكتب اسم الحالة لتسجيلها.");

    const svcIds = f.getAll("svc").map(String), amounts = f.getAll("amount").map(String), monthsA = f.getAll("months").map(String);
    const starts = f.getAll("start").map(String), ends = f.getAll("end").map(String), notes = f.getAll("note").map(String), bens = f.getAll("beneficiary").map((v) => String(v).trim());
    if (!svcIds.length) fail("أضف خدمة واحدة على الأقل.");
    const services = await prisma.service.findMany({ where: { id: { in: svcIds } } });
    const lines = svcIds.map((sid, i) => {
      const n = i + 1;
      const svc = services.find((s) => s.id === sid) ?? fail(`الخدمة ${n}: اختار نوع الخدمة.`);
      const amount = Number(amounts[i]);
      const months = Math.floor(Number(monthsA[i]));
      const start = starts[i], end = ends[i];
      if (!(amount >= 0) || amounts[i] === "") fail(`الخدمة ${n}: اكتب القيمة (0 لو مش مالية).`);
      if (!(months >= 1)) fail(`الخدمة ${n}: المدة لازم تكون شهر على الأقل.`);
      if (!isMonth(start) || !isMonth(end) || end < start) fail(`الخدمة ${n}: تاريخ النهاية قبل البداية.`);
      const span = spanMonths(start, end);
      const note = (notes[i] ?? "").trim();
      if (span !== months && !note) fail(`الخدمة ${n}: المدة المكتوبة ${months} شهر والمحسوبة من التواريخ ${span}. اكتب ملاحظة توضح السبب.`);
      return { svc, amount, months, start, end, note, beneficiary: bens[i] ?? "" };
    });
    lines.forEach((a, i) => lines.forEach((b, j) => { if (j < i && a.svc.id === b.svc.id && a.beneficiary === b.beneficiary && !(a.end < b.start || a.start > b.end)) fail(`الخدمة ${i + 1} مكررة لنفس المستفيد في نفس القرار.`); }));

    // التعارض مع قرار ساري لنفس الخدمة
    const running = await prisma.decisionLine.findMany({ where: { caseCode: code, decision: { status: "active" }, serviceId: { in: lines.map((l) => l.svc.id) } }, include: { decision: true } });
    for (const [i, l] of lines.entries()) {
      const hit = running.find((x) => x.serviceId === l.svc.id && x.beneficiary === l.beneficiary && !(l.end < x.startMonth || l.start > x.endMonth));
      if (hit && !(override && can(u.role, "decision.override"))) {
        fail(`الخدمة ${i + 1}: «${l.svc.name}»${l.beneficiary ? ` لـ${l.beneficiary}` : ""} سارية للحالة في قرار ${hit.decision.no} (${fmtMonth(hit.startMonth)} ← ${fmtMonth(hit.endMonth)}). أوقف القرار القديم أولاً أو اطلب مراجعة المشرف.`);
      }
    }
    let no = str(f, "no");
    if (no && (await prisma.decision.findUnique({ where: { no } }))) fail(`رقم القرار ${no} مسجل من قبل.`);
    no ||= await nextDecisionNo();

    await prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.case.create({ data: { code, name, createdById: u.id, updatedById: u.id } });
        await logAudit(tx, u.id, "case_created", code, { name, via: "decision" });
      }
      const d = await tx.decision.create({
        data: { no, caseCode: code, issueDate: issue!, donor: str(f, "donor"), text: str(f, "text"), overrideNote: override, renewOfId: renewOf || null, createdById: u.id,
          lines: { create: lines.map((l) => ({ caseCode: code, serviceId: l.svc.id, amount: l.amount, months: l.months, startMonth: l.start, endMonth: l.end, mismatchNote: l.note, beneficiary: l.beneficiary })) } },
      });
      if (renewOf) await tx.decision.update({ where: { id: renewOf }, data: { renewalStatus: "renewed", renewalAt: new Date(), renewalById: u.id, renewalNote: `قرار التجديد ${no}` } });
      await logOp(tx, u.id, AUTO_OPS.decision, { caseCode: code, result: `${no} · ${lines.map((l) => l.svc.name).join("، ")}`, ref: d.id });
      await logAudit(tx, u.id, renewOf ? "decision_renewed" : "decision_created", code, { no, lines: lines.length, override: override || undefined });
    });
    return `تم حفظ القرار ${no}${existing ? "" : ` وتسجيل الحالة ${code}`}.`;
  });
  if (r?.ok) redirect(`/cases/${encodeURIComponent(code)}?saved=1`);
  return r;
}

/** إيقاف / سحب / إغلاق كمنتهي — يوقف الاستحقاقات غير المرسلة من الشهر الحالي وما بعده ويلغي مهامها */
export async function stopDecisions(_p: State, f: FormData): Promise<State> {
  const status = str(f, "status") as "stopped" | "withdrawn" | "ended";
  return run(status === "ended" ? "close" : "decision.stop", async (u) => {
    const ids = strs(f, "ids");
    const reason = str(f, "reason");
    if (!ids.length) fail("حدد قراراً واحداً على الأقل.");
    if (!["stopped", "withdrawn", "ended"].includes(status)) fail("اختار الإجراء.");
    if (!reason) fail("اكتب السبب.");
    const cm = currentMonth();
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const d = await tx.decision.findUniqueOrThrow({ where: { id } });
        if (d.status !== "active") continue;
        await tx.decision.update({ where: { id }, data: { status, stopReason: reason, stoppedAt: new Date(), stoppedById: u.id } });
        const ents = await tx.entitlement.findMany({ where: { decisionId: id, sentAt: null, legacySent: false, stoppedAt: null, month: { gte: cm } }, select: { id: true } });
        if (ents.length) {
          await tx.entitlement.updateMany({ where: { id: { in: ents.map((e) => e.id) } }, data: { stoppedAt: new Date(), stoppedReason: reason } });
          await tx.task.updateMany({ where: { entitlementId: { in: ents.map((e) => e.id) }, status: { in: ["new", "in_progress", "stuck"] } }, data: { status: "cancelled", result: `أُلغيت: ${reason}` } });
        }
        await logOp(tx, u.id, AUTO_OPS.closeDecision, { caseCode: d.caseCode, result: `${d.no} · ${DEC_STATUS_LABELS[status]} · ${reason}`, ref: id });
      }
      await logAudit(tx, u.id, "decision_status", `${ids.length} قرار`, { status, reason, ids });
    });
    return `تم تحويل ${ids.length} قرار إلى «${DEC_STATUS_LABELS[status]}».`;
  });
}

/** إرسال قرارات قاربت على الانتهاء للتجديد / إعادة البحث */
export async function sendForRenewal(_p: State, f: FormData): Promise<State> {
  return run("renewal", async (u) => {
    const ids = strs(f, "ids");
    const note = str(f, "note");
    if (!ids.length) fail("حدد قراراً واحداً على الأقل.");
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const d = await tx.decision.update({ where: { id }, data: { renewalStatus: "sent", renewalAt: new Date(), renewalById: u.id, renewalNote: note } });
        await logOp(tx, u.id, AUTO_OPS.renewal, { caseCode: d.caseCode, result: `إرسال للتجديد · ${d.no}`, notes: note, ref: id });
      }
      await logAudit(tx, u.id, "renewal_sent", `${ids.length} قرار`, { note });
    });
    return `أُرسلت ${ids.length} حالة للتجديد.`;
  });
}

export async function markNotRenewed(_p: State, f: FormData): Promise<State> {
  return run("renewal", async (u) => {
    const id = str(f, "id");
    const d = await prisma.decision.update({ where: { id }, data: { renewalStatus: "not_renewed", renewalAt: new Date(), renewalById: u.id } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "renewal_not_renewed", target: d.caseCode, meta: { no: d.no } } });
    return "سُجل: لم يُجدد.";
  });
}
