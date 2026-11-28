"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma, SettleHow } from "@prisma/client";
import { addDays, dateOf, fail, num, run, str, strs, type State } from "@/lib/action";
import { AUTO_OPS, POLICY_LABELS, RECV_METHODS, WALLET_METHODS } from "@/lib/constants";
import { applyCaseChanges, readCaseFields } from "@/lib/case-changes";
import { loadEnt, loadEnts } from "@/lib/entitlements";
import { logAudit, logOp } from "@/lib/ops";
import { addMonths, fmtMonth, isMonth } from "@/lib/months";
import { getSettings } from "@/lib/settings";
import { canFollow, canSend, followRequired, type Kind } from "@/lib/stage";
import { money } from "@/lib/format";
import { dupText, findDuplicates } from "@/lib/duplicates";
import { recvMissing } from "@/lib/recv";

type Tx = Prisma.TransactionClient;
const due = (days: number) => addDays(new Date(), days);

/** المبلغ غير المستلم في استحقاق (للترحيل) */
async function unreceivedOf(tx: Tx, entId: string) {
  const e = await tx.entitlement.findUniqueOrThrow({ where: { id: entId }, include: { refunds: true, transfer: true } });
  const refunded = e.refunds.reduce((s, r) => s + Number(r.amount), 0);
  const received = e.followResult === "received" ? Math.max(0, Number(e.transfer?.amount ?? e.amount) - refunded) : 0;
  return Math.max(0, Number(e.amount) - received);
}

/** يطبق سياسة الشهر غير المستلم: ترحيل على استحقاق لاحق، أو تمديد الخدمة، أو لا شيء — مرة واحدة فقط */
async function applyPolicy(tx: Tx, prevId: string, how: SettleHow, userId: string, note: string, targetId?: string) {
  const prev = await tx.entitlement.findUniqueOrThrow({ where: { id: prevId } });
  if (prev.settledHow) return; // اتسوّى قبل كده — لا يُعوَّض مرتين
  await tx.entitlement.update({ where: { id: prevId }, data: { settledHow: how, settledAt: new Date(), settledById: userId, settledNote: note } });
  if (how === "extend") {
    const l = await tx.decisionLine.findUniqueOrThrow({ where: { id: prev.lineId } });
    await tx.decisionLine.update({ where: { id: l.id }, data: { endMonth: addMonths(l.endMonth, 1), extendedBy: { increment: 1 } } });
    await logAudit(tx, userId, "line_extended", prev.caseCode, { old: l.endMonth, new: addMonths(l.endMonth, 1), for: prev.month });
  }
  if (how === "carry") {
    const target = targetId
      ? await tx.entitlement.findUnique({ where: { id: targetId } })
      : await tx.entitlement.findUnique({ where: { lineId_month: { lineId: prev.lineId, month: addMonths(prev.month, 1) } } });
    if (target && !target.sentAt && !target.carriedFromId) {
      const amt = await unreceivedOf(tx, prevId);
      if (amt > 0) await tx.entitlement.update({ where: { id: target.id }, data: { amount: { increment: amt }, carriedAmount: amt, carriedFromId: prevId } });
    }
    // لو الشهر التالي لسه ما اتولدش، التوليد هيضيف المبلغ (carriedFromId)
  }
}

// ───────────── توليد استحقاقات الشهر ─────────────
export async function generateMonth(_p: State, f: FormData): Promise<State> {
  return run("generate", async (u) => {
    const m = str(f, "m");
    if (!isMonth(m)) fail("اختار الشهر.");
    const st = await getSettings();
    const lines = await prisma.decisionLine.findMany({
      where: { decision: { status: "active" }, stoppedAt: null, startMonth: { lte: m }, endMonth: { gte: m } },
      include: { service: true, decision: true, _count: { select: { entitlements: true } } },
    });
    // الشهري والتغطية: استحقاق كل شهر · مرة واحدة: مرة بس، في أول شهر يتولد فيه جوه مدته (لو ما اتنفذتش في شهر البداية)
    const eligible = lines.filter((l) => l.service.cycle !== "once" || l._count.entitlements === 0);
    const existing = new Set((await prisma.entitlement.findMany({ where: { month: m, lineId: { in: eligible.map((l) => l.id) } }, select: { lineId: true } })).map((e) => e.lineId));
    const todo = eligible.filter((l) => !existing.has(l.id));
    if (!todo.length) fail(`لا توجد استحقاقات جديدة لـ${fmtMonth(m)}. لا يُنشأ استحقاق بعد تاريخ نهاية القرار.`);

    const codes = [...new Set(todo.map((l) => l.caseCode))];
    const confirmed = new Set([
      ...(await prisma.case.findMany({ where: { code: { in: codes }, dataConfirmed: true }, select: { code: true } })).map((c) => c.code),
      ...(await prisma.entitlement.findMany({ where: { caseCode: { in: codes }, OR: [{ followResult: "received" }, { legacySent: true }] }, select: { caseCode: true }, distinct: ["caseCode"] })).map((e) => e.caseCode),
    ]);
    // الشهر السابق المُسوّى بالترحيل ولم يُرحّل بعد
    const prevCarry = await prisma.entitlement.findMany({ where: { month: addMonths(m, -1), lineId: { in: todo.map((l) => l.id) }, settledHow: "carry" } });
    const carried = new Set((await prisma.entitlement.findMany({ where: { carriedFromId: { in: prevCarry.map((p) => p.id) } }, select: { carriedFromId: true } })).map((e) => e.carriedFromId));

    // فريق البيانات: الحالات اللي بيانات استلامها ناقصة (حتى لو مؤكدة قبل كده) أو محتاجة تأكيد
    const caseRows = await prisma.case.findMany({ where: { code: { in: codes } }, select: { code: true, phone: true, recvName: true, recvIdNo: true, residencyStatus: true, residencyExpiry: true } });
    const missingFor = new Map(caseRows.map((c) => [c.code, recvMissing(c)]));
    const openDataTask = new Set((await prisma.task.findMany({ where: { kind: "confirm", caseCode: { in: codes }, status: { in: ["new", "in_progress", "stuck"] } }, select: { caseCode: true } })).map((t) => t.caseCode));
    const created = await prisma.$transaction(async (tx) => {
      const confTaskFor = new Set<string>(openDataTask as Set<string>);
      let n = 0, needConf = 0;
      for (const l of todo) {
        const p = prevCarry.find((x) => x.lineId === l.id && !carried.has(x.id));
        const extra = p ? await unreceivedOf(tx, p.id) : 0;
        const needsConfirm = !confirmed.has(l.caseCode);
        const e = await tx.entitlement.create({
          data: { lineId: l.id, decisionId: l.decisionId, caseCode: l.caseCode, month: m, baseAmount: l.amount, amount: Number(l.amount) + extra,
            carriedAmount: extra, carriedFromId: p && extra ? p.id : null, needsConfirm, createdById: u.id },
        });
        n++;
        const miss = missingFor.get(l.caseCode) ?? [];
        if (miss.length) {
          needConf++;
          if (!confTaskFor.has(l.caseCode)) {
            confTaskFor.add(l.caseCode);
            await tx.task.create({ data: { kind: "confirm", title: `استكمال بيانات الاستلام: ${miss.join("، ")}`, opType: AUTO_OPS.confirm, caseCode: l.caseCode, entitlementId: e.id, assigneeId: st.assign.confirm || null, dueAt: due(st.confirmDays), createdById: u.id } });
          }
        }
      }
      await logOp(tx, u.id, AUTO_OPS.generate, { dept: fmtMonth(m), result: `${n} استحقاق` });
      await logAudit(tx, u.id, "month_generated", m, { count: n, needConfirm: needConf });
      return { n, needConf };
    }, { timeout: 120_000 });
    return `تم توليد ${created.n} استحقاق لـ${fmtMonth(m)}${created.needConf ? ` · ${created.needConf} بيانات استلامه ناقصة (في «استكمال البيانات»)` : ""}.`;
  });
}

// ───────────── مكالمة تأكيد البيانات ─────────────
export async function confirmData(_p: State, f: FormData): Promise<State> {
  return run("confirm", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId");
    const result = str(f, "result");
    const note = str(f, "note");
    const ent = await loadEnt(id, st.followDays);
    if (!ent) fail("الاستحقاق غير موجود.");
    const e = ent!;
    if (e.stage !== "missing") fail("بيانات الاستلام لهذه الحالة مكتملة بالفعل.");
    if (!result) fail("اختار نتيجة المكالمة.");
    if (result === "no_answer") {
      const tries = await prisma.contactAttempt.count({ where: { entitlement: { caseCode: e.caseCode }, kind: "confirm", voided: false, answered: false, createdAt: { gte: addDays(new Date(), -40) } } });
      await prisma.$transaction(async (tx) => {
        await tx.contactAttempt.create({ data: { entitlementId: id, kind: "confirm", answered: false, result: "لم يرد", note, userId: u.id } });
        const n = tries + 1;
        await tx.task.updateMany({ where: { kind: "confirm", caseCode: e.caseCode, status: { in: ["new", "in_progress"] } }, data: n >= 3 ? { status: "stuck", result: "3 محاولات بدون رد" } : { status: "in_progress", startedAt: new Date() } });
        await logOp(tx, u.id, AUTO_OPS.confirm, { caseCode: e.caseCode, result: `لم يرد (محاولة ${n})`, notes: note, ref: id });
        await logAudit(tx, u.id, "confirm_no_answer", e.caseCode, { attempt: n });
      });
      return tries + 1 >= 3 ? "3 محاولات بدون رد. لو الشهر عدّى من غير ما نوصل للحالة هتظهر في «قائمة الغلق»." : `سُجلت المحاولة ${tries + 1}.`;
    }
    const patch = readCaseFields(f);
    const c0 = await prisma.case.findUniqueOrThrow({ where: { code: e.caseCode } });
    const after = { ...c0, ...patch } as typeof c0;
    const miss = recvMissing(after);
    if (e.kind === "financial" && !miss.length) {
      const method = String(after.recvMethod ?? "");
      if (!RECV_METHODS.includes(method)) fail("طريقة الاستلام مطلوبة قبل الإرسال للصرف.");
      if (WALLET_METHODS.includes(method) && !after.recvPhone) fail("رقم المحفظة / الاستلام مطلوب.");
    }
    await prisma.$transaction(async (tx) => {
      await applyCaseChanges(tx, e.caseCode, patch, u.id, "مكالمة استكمال / تأكيد بيانات");
      await tx.contactAttempt.create({ data: { entitlementId: id, kind: "confirm", answered: true, result: miss.length ? `تم الرد · لسه ناقص: ${miss.join("، ")}` : result === "updated" ? "تم الرد وتحديث البيانات" : "تم الرد وتأكيد البيانات", note, userId: u.id } });
      if (!miss.length) {
        await tx.case.update({ where: { code: e.caseCode }, data: { dataConfirmed: true, confirmedAt: new Date(), confirmedById: u.id } });
        await tx.entitlement.updateMany({ where: { caseCode: e.caseCode, needsConfirm: true, confirmedAt: null }, data: { confirmedAt: new Date(), confirmedById: u.id, confirmNote: note || "تم التأكيد" } });
        await tx.task.updateMany({ where: { kind: "confirm", caseCode: e.caseCode, status: { in: ["new", "in_progress", "stuck"] } }, data: { status: "done", completedAt: new Date(), completedById: u.id, result: "اكتملت بيانات الاستلام" } });
      } else {
        await tx.task.updateMany({ where: { kind: "confirm", caseCode: e.caseCode, status: "new" }, data: { status: "in_progress", startedAt: new Date() } });
      }
      await logOp(tx, u.id, AUTO_OPS.confirm, { caseCode: e.caseCode, result: miss.length ? `تم الرد · ناقص ${miss.join("، ")}` : "اكتملت البيانات", notes: note, ref: id });
      await logAudit(tx, u.id, miss.length ? "data_partial" : "data_confirmed", e.caseCode, miss.length ? { missing: miss } : undefined);
    });
    if (miss.length) return `اتحفظ اللي اتكتب، لكن لسه ناقص: ${miss.join("، ")}. الحالة هتفضل في «استكمال البيانات» ومش هتتبعت لحد ما تكمل.`;
    const c2 = await prisma.case.findUniqueOrThrow({ where: { code: e.caseCode } });
    return `اكتملت بيانات الاستلام. الحالة جاهزة للإرسال في الدفعة.${dupText(await findDuplicates(e.caseCode, c2))}`;
  });
}

// ───────────── اعتماد إدراج استحقاق معلّق ─────────────
export async function approveHold(_p: State, f: FormData): Promise<State> {
  return run("approve", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId");
    const how = str(f, "how") as SettleHow;
    const reason = str(f, "reason");
    if (!reason) fail("اكتب سبب الاعتماد.");
    if (!["carry", "extend", "drop"].includes(how)) fail("اختار طريقة معالجة الشهر غير المستلم.");
    const e = await loadEnt(id, st.followDays);
    if (!e || e.stage !== "hold") fail("هذا الاستحقاق غير معلّق.");
    const prev = await prisma.entitlement.findUnique({ where: { lineId_month: { lineId: e!.lineId, month: addMonths(e!.month, -1) } } });
    await prisma.$transaction(async (tx) => {
      await tx.entitlement.update({ where: { id }, data: { holdApprovedAt: new Date(), holdApprovedById: u.id, holdApprovedReason: reason, holdApprovedHow: how } });
      if (prev) await applyPolicy(tx, prev.id, how, u.id, `اعتماد إدراج ${fmtMonth(e!.month)}: ${reason}`, id);
      await logAudit(tx, u.id, "hold_approved", e!.caseCode, { month: e!.month, how, reason });
    });
    return `تم الاعتماد (${POLICY_LABELS[how]}). يمكن إرسال الحالة الآن.`;
  });
}

// ───────────── الإرسال ضمن دفعة ─────────────
export async function sendBatch(_p: State, f: FormData): Promise<State> {
  return run("send", async (u) => {
    const st = await getSettings();
    const ids = strs(f, "ids");
    if (!ids.length) fail("حدد حالة واحدة على الأقل.");
    const ents = await loadEnts({ id: { in: ids } }, st.followDays);
    const ok = ents.filter((e) => canSend(e.stage));
    const blocked = ents.length - ok.length;
    if (!ok.length) fail("لا يوجد في التحديد ما يمكن إرساله. اللي بيانات استلامها ناقصة أو محتاجة تأكيد بتكمل الأول في «استكمال البيانات».");
    const cycleMonth = isMonth(str(f, "m")) ? str(f, "m") : "";
    const byKind = new Map<Kind, typeof ok>();
    ok.forEach((e) => byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]));
    const codes: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const [kind, list] of byKind) {
        const month = cycleMonth || list[0].month;
        const total = list.reduce((s, e) => s + e.amountN, 0);
        const code = `B-${month}-${kind}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
        codes.push(code);
        const b = await tx.paymentBatch.create({ data: { code, month, kind, count: list.length, total, userId: u.id } });
        await tx.entitlement.updateMany({ where: { id: { in: list.map((e) => e.id) } }, data: { sentAt: new Date(), sentById: u.id, batchId: b.id } });
        // أي خدمة اتبعتت بتنزل المتابعة فوراً (فريق المتابعة يتأكد من الاستلام)
        for (const e of list.filter((x) => followRequired(x.kind, x.line.service.needsFollow))) {
          await tx.task.create({ data: { kind: "follow", title: kind === "financial" ? "مكالمة متابعة صرف" : "مكالمة متابعة استلام", opType: AUTO_OPS.follow, caseCode: e.caseCode, entitlementId: e.id, assigneeId: st.assign.follow || null, dueAt: due(st.followDays), createdById: u.id } });
        }
        const label = kind === "in_kind" ? AUTO_OPS.sendInKind : kind === "card" ? AUTO_OPS.sendCard : kind === "service" ? AUTO_OPS.serviceDone : AUTO_OPS.send;
        await logOp(tx, u.id, label, { dept: `دفعة ${code}`, result: `${list.length} حالة · ${money(total)} ج`, count: list.length, ref: code });
        await logAudit(tx, u.id, "batch_sent", code, { count: list.length, total, kind });
      }
    });
    const missing = ents.filter((e) => e.stage === "missing").length;
    return `أُرسلت ${ok.length} حالة (${codes.join("، ")}) ونزلت المتابعة${blocked ? ` · لم تُرسل ${blocked}${missing ? ` (منها ${missing} بيانات استلام ناقصة)` : ""} لأنها غير جاهزة` : ""}. شيت الدفعة Excel في «دفعات الشهر».`;
  });
}

// ───────────── التحويل المالي ─────────────
export async function recordTransfer(_p: State, f: FormData): Promise<State> {
  return run("transfer", async (u) => {
    const st = await getSettings();
    const ids = strs(f, "ids");
    const bulk = str(f, "bulk") === "1";
    const method = str(f, "method"), ref = str(f, "ref");
    const date = dateOf(str(f, "date"));
    if (!method || !date || !ref) fail("طريقة التحويل وتاريخه ورقم المرجع إلزامية.");
    const ents = await loadEnts({ id: { in: ids } }, st.followDays);
    const list = ents.filter((e) => e.kind === "financial" && e.sentAt && !e.transfer && !e.stoppedAt && e.stage !== "missing");
    if (!list.length) fail("لا توجد استحقاقات مالية مُرسلة تنتظر التحويل في التحديد.");
    const one = bulk ? null : num(f, "amount");
    if (!bulk && !(one! > 0)) fail("اكتب قيمة المبلغ المحوّل.");
    const clash = await prisma.transfer.findFirst({ where: { ref, entitlementId: { notIn: list.map((e) => e.id) } }, include: { entitlement: true } });
    if (clash && !(bulk && clash.batchRef)) fail(`رقم المرجع ${ref} مستخدم من قبل للحالة ${clash.entitlement.caseCode} (${fmtMonth(clash.entitlement.month)}). راجع الرقم.`);
    const total = list.reduce((s, e) => s + (bulk ? e.amountN : one!), 0);
    await prisma.$transaction(async (tx) => {
      for (const e of list) {
        await tx.transfer.create({ data: { entitlementId: e.id, amount: bulk ? e.amountN : one!, method, date: date!, ref, batchRef: bulk, userId: u.id } });
        const ft = await tx.task.findFirst({ where: { kind: "follow", entitlementId: e.id } });
        if (!ft) await tx.task.create({ data: { kind: "follow", title: "مكالمة متابعة صرف", opType: AUTO_OPS.follow, caseCode: e.caseCode, entitlementId: e.id, assigneeId: st.assign.follow || null, dueAt: addDays(date!, st.followDays), createdById: u.id } });
      }
      await logOp(tx, u.id, AUTO_OPS.transfer, { caseCode: list.length === 1 ? list[0].caseCode : null, dept: list.length > 1 ? `مرجع ${ref}` : "", date: date!, result: `${list.length} تحويل · ${money(total)} ج · ${method}`, count: list.length, ref });
      await logAudit(tx, u.id, "transfer", list.length === 1 ? list[0].caseCode : `مرجع ${ref}`, { count: list.length, total, method, ref });
    });
    return `سُجل التحويل لـ${list.length} حالة. التحويل وحده لا يعني الاستلام: الحالات الآن في المتابعة.`;
  });
}

// ───────────── المتابعة ─────────────
export async function followCall(_p: State, f: FormData): Promise<State> {
  return run("follow", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId");
    const a = str(f, "a"); // no_answer | paid
    const note = str(f, "note");
    const e = await loadEnt(id, st.followDays);
    if (!e) fail("الاستحقاق غير موجود.");
    if (e!.missing.length && !e!.legacySent) fail(`مينفعش تسجيل متابعة أو استلام وبيانات الاستلام ناقصة: ${e!.missing.join("، ")}. كمّلها الأول من «استكمال البيانات».`);
    // رد متأخر بعد 3 محاولات، أو اتصرف بعد ما كان «تم الرد ولم يتم الصرف» (معاودة الاتصال)
    const late = (e!.stage === "noans" && e!.followResult === "no_answer") || e!.stage === "notpaid";
    if (!(canFollow(e!.stage) && !e!.followDone) && !(late && a === "paid")) fail("لا يمكن تسجيل متابعة على هذا الاستحقاق في مرحلته الحالية.");
    if (a === "no_answer" && e!.unanswered >= 3) fail("اكتملت 3 محاولات بالفعل. يمكن فقط تسجيل رد متأخر.");
    let msg = "";
    await prisma.$transaction(async (tx) => {
      await tx.contactAttempt.create({ data: { entitlementId: id, kind: "follow", answered: a === "paid", result: a === "paid" ? "تم الصرف" : "لم يرد", note, userId: u.id } });
      if (a === "paid") {
        await tx.entitlement.update({ where: { id }, data: { followResult: "received", followAt: new Date(), followById: u.id } });
        await tx.task.updateMany({ where: { kind: "follow", entitlementId: id }, data: { status: "done", completedAt: new Date(), completedById: u.id, result: late ? "رد متأخر · تم الصرف" : "تم الرد وتم الصرف" } });
        if (e!.stage === "notpaid") await tx.task.updateMany({ where: { kind: "action", entitlementId: id, status: { in: ["new", "in_progress", "stuck"] } }, data: { status: "done", completedAt: new Date(), completedById: u.id, result: "معاودة الاتصال: تم الصرف" } });
        msg = "سُجل: رد وتم الصرف. اكتملت دورة الشهر لهذه الحالة.";
      } else {
        const n = e!.unanswered + 1;
        if (n >= 3) {
          await tx.entitlement.update({ where: { id }, data: { followResult: "no_answer", followAt: new Date(), followById: u.id } });
          await tx.task.updateMany({ where: { kind: "follow", entitlementId: id }, data: { status: "done", completedAt: new Date(), completedById: u.id, result: "اكتملت 3 محاولات بدون رد" } });
          msg = "اكتملت 3 محاولات بدون رد. مسؤولية الموظف مستوفاة، والاستلام غير مكتمل.";
        } else {
          await tx.task.updateMany({ where: { kind: "follow", entitlementId: id, status: "new" }, data: { status: "in_progress", startedAt: new Date() } });
          msg = `سُجلت المحاولة ${n} من 3.`;
        }
      }
      await logOp(tx, u.id, AUTO_OPS.follow, { caseCode: e!.caseCode, result: a === "paid" ? "رد · تم الصرف" : `لم يرد (${e!.unanswered + 1}/3)`, notes: note, ref: id });
      await logAudit(tx, u.id, "follow_call", e!.caseCode, { month: e!.month, result: a });
    });
    return msg;
  });
}

export async function followNotPaid(_p: State, f: FormData): Promise<State> {
  return run("follow", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId"), reason = str(f, "reason"), action = str(f, "action"), note = str(f, "note"), assignee = str(f, "assignee");
    if (!reason || !action) fail("السبب والإجراء المطلوب إلزاميان.");
    const e = await loadEnt(id, st.followDays);
    if (e && e.stage === "missing") fail(`مينفعش تسجيل متابعة وبيانات الاستلام ناقصة: ${e.missing.join("، ")}.`);
    if (!e || !canFollow(e.stage) || e.followDone) fail("لا يمكن تسجيل متابعة على هذا الاستحقاق في مرحلته الحالية.");
    await prisma.$transaction(async (tx) => {
      await tx.contactAttempt.create({ data: { entitlementId: id, kind: "follow", answered: true, result: "لم يتم الصرف", note: `${reason}${note ? ` · ${note}` : ""}`, userId: u.id } });
      await tx.entitlement.update({ where: { id }, data: { followResult: "not_received", followAt: new Date(), followById: u.id, notPaidReason: reason, notPaidAction: action } });
      await tx.task.updateMany({ where: { kind: "follow", entitlementId: id }, data: { status: "done", completedAt: new Date(), completedById: u.id, result: `رد · لم يتم الصرف: ${reason}` } });
      await tx.task.create({ data: { kind: "action", title: `معالجة عدم صرف: ${action}`, opType: AUTO_OPS.action, caseCode: e!.caseCode, entitlementId: id, assigneeId: assignee || st.assign.action || null, dueAt: due(st.actionDays), notes: note, createdById: u.id } });
      await logOp(tx, u.id, AUTO_OPS.follow, { caseCode: e!.caseCode, result: `رد · لم يتم الصرف · ${reason}`, notes: action, ref: id });
      await logAudit(tx, u.id, "follow_not_paid", e!.caseCode, { month: e!.month, reason, action });
    });
    return "سُجل عدم الصرف وأُنشئت مهمة المعالجة.";
  });
}

export async function setStuck(_p: State, f: FormData): Promise<State> {
  return run("follow", async (u) => {
    const id = str(f, "entId"), reason = str(f, "reason"), clear = str(f, "clear") === "1";
    if (!clear && !reason) fail("اكتب سبب التعثر.");
    const e = await prisma.entitlement.update({ where: { id }, data: clear ? { stuckReason: "", stuckAt: null, stuckById: null } : { stuckReason: reason, stuckAt: new Date(), stuckById: u.id } });
    await prisma.auditLog.create({ data: { userId: u.id, action: clear ? "unstuck" : "stuck", target: e.caseCode, meta: { month: e.month, reason } } });
    return clear ? "أُلغي التعثر." : "سُجل الاستحقاق متعثراً.";
  });
}

// ───────────── الاسترداد ─────────────
export async function recordRefund(_p: State, f: FormData): Promise<State> {
  return run("refund", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId");
    const amount = num(f, "amount"), date = dateOf(str(f, "date")), reason = str(f, "reason"), note = str(f, "note");
    const settle = str(f, "settlement") === "settled" ? "settled" : "pending";
    const how = (str(f, "how") || st.policy) as SettleHow;
    const e = await loadEnt(id, st.followDays);
    if (!e || e.transferred <= 0) fail("لا يوجد تحويل على هذا الاستحقاق.");
    const max = e!.transferred - e!.refundTotal;
    if (!(amount > 0)) fail("اكتب قيمة المبلغ المسترد.");
    if (amount > max + 0.001) fail(`المبلغ المسترد أكبر من المتبقي من التحويل (${money(max)} ج).`);
    if (!date || !reason) fail("تاريخ الاسترداد وسببه إلزاميان.");
    const full = e!.refundTotal + amount >= e!.transferred - 0.001;
    await prisma.$transaction(async (tx) => {
      await tx.refund.create({ data: { entitlementId: id, caseCode: e!.caseCode, month: e!.month, transferAmount: e!.transferred, amount, date: date!, reason, ref: e!.transfer?.ref ?? "", type: full ? "full" : "partial", settlement: settle, how, note, userId: u.id, ...(settle === "settled" ? { settledAt: new Date(), settledById: u.id } : {}) } });
      if (full && settle === "settled") await applyPolicy(tx, id, how, u.id, `استرداد كلي: ${reason}`);
      await logOp(tx, u.id, AUTO_OPS.refund, { caseCode: e!.caseCode, date: date!, result: `${full ? "كلي" : "جزئي"} · ${money(amount)} ج · ${reason}`, ref: id });
      await logAudit(tx, u.id, "refund", e!.caseCode, { month: e!.month, amount, transferred: e!.transferred, type: full ? "full" : "partial", reason });
    });
    return `سُجل الاسترداد (${full ? "كلي" : "جزئي"}). صافي المصروف تحدّث تلقائياً.`;
  });
}

export async function settleRefund(_p: State, f: FormData): Promise<State> {
  return run("refund", async (u) => {
    const id = str(f, "id");
    const how = str(f, "how") as SettleHow;
    if (!["carry", "extend", "drop"].includes(how)) fail("اختار طريقة المعالجة.");
    const r = await prisma.refund.findUniqueOrThrow({ where: { id } });
    if (r.settlement === "settled") fail("تمت تسوية هذا الاسترداد من قبل.");
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id }, data: { settlement: "settled", how, settledAt: new Date(), settledById: u.id } });
      if (r.type === "full") await applyPolicy(tx, r.entitlementId, how, u.id, "تسوية استرداد");
      await logAudit(tx, u.id, "refund_settled", r.caseCode, { how });
    });
    return "تمت التسوية.";
  });
}

export async function completeAction(_p: State, f: FormData): Promise<State> {
  return run("task", async (u) => {
    const taskId = str(f, "taskId"), result = str(f, "result");
    if (!result) fail("اكتب ما تم تنفيذه.");
    const t = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data: { status: "done", completedAt: new Date(), completedById: u.id, result } });
      await logOp(tx, u.id, AUTO_OPS.action, { caseCode: t.caseCode, result, ref: t.entitlementId ?? "" });
      await logAudit(tx, u.id, "action_done", t.caseCode, { result });
    });
    return "أُغلقت مهمة المعالجة.";
  });
}


/** أزرار الإجراءات الجماعية في دورة الصرف (الزرار المضغوط بيحدد الإجراء) */
export async function cycleBulk(p: State, f: FormData): Promise<State> {
  const op = str(f, "op");
  if (op === "send") return sendBatch(p, f);
  if (op === "transfer") { f.set("bulk", "1"); return recordTransfer(p, f); }
  return { error: "اختار الإجراء." };
}

/** إعادة إرسال الكارت (من النظام السابق): المتابعة تبدأ من جديد، والمحاولات القديمة تفضل في السجل */
export async function resendCard(_p: State, f: FormData): Promise<State> {
  return run("send", async (u) => {
    const st = await getSettings();
    const id = str(f, "entId"), reason = str(f, "reason");
    if (!reason) fail("اكتب سبب إعادة الإرسال.");
    const e = await loadEnt(id, st.followDays);
    if (!e || e.kind !== "card" || !e.sentAt) fail("إعادة الإرسال متاحة للكروت المُرسلة فقط.");
    if (e!.stage === "recv" || e!.stage === "stop") fail("لا يمكن إعادة الإرسال في هذه المرحلة.");
    await prisma.$transaction(async (tx) => {
      await tx.contactAttempt.updateMany({ where: { entitlementId: id, kind: "follow" }, data: { voided: true } });
      await tx.entitlement.update({ where: { id }, data: { sentAt: new Date(), sentById: u.id, resendCount: { increment: 1 }, followResult: "none", followAt: null, followById: null, notPaidReason: "", notPaidAction: "", stuckReason: "" } });
      await tx.task.updateMany({ where: { kind: "action", entitlementId: id, status: { in: ["new", "in_progress"] } }, data: { status: "cancelled", result: "أُلغيت: إعادة إرسال الكارت" } });
      const t = await tx.task.findUnique({ where: { kind_entitlementId: { kind: "follow", entitlementId: id } } });
      if (t) await tx.task.update({ where: { id: t.id }, data: { status: "new", completedAt: null, completedById: null, dueAt: due(st.followDays), result: "" } });
      else await tx.task.create({ data: { kind: "follow", title: "مكالمة متابعة استلام", opType: AUTO_OPS.follow, caseCode: e!.caseCode, entitlementId: id, assigneeId: st.assign.follow || null, dueAt: due(st.followDays), createdById: u.id } });
      await logOp(tx, u.id, AUTO_OPS.resendCard, { caseCode: e!.caseCode, result: reason, ref: id });
      await logAudit(tx, u.id, "card_resent", e!.caseCode, { month: e!.month, reason, count: e!.resendCount + 1 });
    });
    return "تمت إعادة إرسال الكارت. المتابعة بدأت من جديد.";
  });
}
