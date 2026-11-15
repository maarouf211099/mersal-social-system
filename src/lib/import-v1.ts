import "server-only";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { DecisionStatus, ServiceKind } from "@prisma/client";
import { prisma } from "./prisma";
import { ActionError } from "./auth";

// استيراد نسخة احتياطية (JSON) من النظام السابق (صفحة HTML v1 / v2)
// يُشغَّل مرة واحدة على قاعدة فاضية — كله في transaction واحدة: يا ينجح كله يا مايتحفظش حاجة
type Doc = Record<string, any>;
const vals = (o: unknown): Doc[] => (o && typeof o === "object" ? Object.values(o as Record<string, Doc>) : []);
const ts = (v: unknown) => (typeof v === "number" && v > 0 ? new Date(v) : null);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const KIND: Record<string, ServiceKind> = { "مالي": "financial", "كارت": "card", "عيني": "in_kind", "خدمة": "service", "تغطية": "service" };
const STATUS: Record<string, DecisionStatus> = { "مستمر": "active", "موقوف": "stopped", "مسحوب": "withdrawn", "منتهي": "ended" };
const OPST: Record<string, "new" | "in_progress" | "done"> = { "جديد": "new", "جاري": "in_progress", "تم": "done" };

export async function importV1(data: Doc, importerId: string): Promise<string> {
  if (!data || typeof data !== "object" || !data.cases) throw new ActionError("الملف لا يحتوي على بيانات النظام السابق (cases).");
  if (await prisma.case.count()) throw new ActionError("قاعدة البيانات فيها حالات بالفعل. الاستيراد متاح مرة واحدة على قاعدة فاضية فقط.");

  const cases = vals(data.cases), decs = vals(data.decisions), lines = vals(data.lines), ents = vals(data.ents);
  const ops = vals(data.ops), refunds = vals(data.refunds), staff = vals(data.staff), cfgServices: Doc[] = data.config?.main?.services ?? [];

  return prisma.$transaction(async (tx) => {
    // المستخدمون السابقون: حسابات موقوفة باسمهم عشان التاريخ يفضل منسوب لأصحابه
    const userMap = new Map<string, string>();
    const legacyIds = new Set<string>();
    for (const o of ops) if (o.by) legacyIds.add(o.by);
    for (const e of ents) { for (const a of e.attempts ?? []) if (a.by) legacyIds.add(a.by); if (e.sentBy) legacyIds.add(e.sentBy); }
    let k = 0;
    for (const id of legacyIds) {
      const st = staff.find((x) => x.id === id);
      const u = await tx.user.create({ data: {
        email: `legacy-${++k}-${randomBytes(3).toString("hex")}@legacy.local`, name: s(st?.label) || `مستخدم سابق ${k}`,
        passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 4), role: "viewer", isActive: false, mustChangePassword: true, team: "مستورد",
      } });
      userMap.set(id, u.id);
    }
    const uid = (id: unknown) => (typeof id === "string" ? userMap.get(id) ?? null : null);

    // الحالات
    for (const c of cases) {
      const code = s(c.code || c.id);
      if (!code) continue;
      await tx.case.create({ data: {
        code, name: s(c.name) || "(بدون اسم)", birthDate: day(c.birth), gender: s(c.gender), nationality: s(c.nationality),
        familySize: Number(c.familySize) > 0 ? Math.floor(Number(c.familySize)) : null, governorate: s(c.governorate), address: s(c.address),
        phone: s(c.phone), phone2: s(c.phone2), unhcr: s(c.unhcr), recvMethod: s(c.recvMethod), recvName: s(c.recvName), recvPhone: s(c.recvPhone),
        recvIdNo: s(c.recvId), recvBranch: s(c.recvBranch), notes: s(c.notes), dataConfirmed: !!c.dataConfirmed,
        createdAt: ts(c.createdAt) ?? new Date(), createdById: importerId,
      } });
    }
    const caseCodes = new Set(cases.map((c) => s(c.code || c.id)));

    // الخدمات: الموجودة بالاسم، والناقصة تتضاف
    const svcByName = new Map((await tx.service.findMany()).map((x) => [x.name, x]));
    const svcKind = (name: string) => cfgServices.find((x) => x.name === name)?.kind ?? ents.find((e) => e.service === name)?.kind ?? "مالي";
    for (const name of new Set(lines.map((l) => s(l.service)))) {
      if (!name || svcByName.has(name)) continue;
      const cyc = cfgServices.find((x) => x.name === name)?.cycle;
      const created = await tx.service.create({ data: { name, kind: KIND[svcKind(name)] ?? "financial", cycle: cyc === "مرة واحدة" ? "once" : cyc?.startsWith("تغطية") ? "coverage" : "monthly", needsFollow: true, sort: 900 } });
      svcByName.set(name, created);
    }

    // القرارات والخدمات
    const usedNo = new Set<string>();
    const decMap = new Map<string, string>(), lineMap = new Map<string, string>();
    for (const d of decs) {
      if (!caseCodes.has(s(d.code))) continue;
      let no = s(d.no) || `ق-مستورد-${decMap.size + 1}`;
      while (usedNo.has(no)) no += "ب";
      usedNo.add(no);
      const r = await tx.decision.create({ data: {
        no, caseCode: s(d.code), issueDate: day(d.issueDate) ?? new Date(), donor: s(d.donor), text: s(d.text), status: STATUS[s(d.status)] ?? "active",
        stopReason: s(d.stopReason), stoppedAt: day(d.stopDate), stoppedById: uid(d.stoppedBy), createdAt: ts(d.createdAt) ?? new Date(), createdById: importerId,
        renewalStatus: d.renewal?.status === "أُرسلت للتجديد" ? "sent" : d.renewal?.status === "تم التجديد" ? "renewed" : d.renewal?.status === "لم يُجدد" ? "not_renewed" : "none",
        renewalAt: ts(d.renewal?.at),
      } });
      decMap.set(d.id, r.id);
    }
    for (const l of lines) {
      const decisionId = decMap.get(l.decId);
      const svc = svcByName.get(s(l.service));
      if (!decisionId || !svc || !/^\d{4}-\d{2}$/.test(l.startMonth) || !/^\d{4}-\d{2}$/.test(l.endMonth)) continue;
      const r = await tx.decisionLine.create({ data: {
        decisionId, caseCode: s(l.code), serviceId: svc.id, amount: Number(l.amount) || 0, months: Math.max(1, Number(l.months) || 1),
        startMonth: l.startMonth, endMonth: l.endMonth < l.startMonth ? l.startMonth : l.endMonth, mismatchNote: s(l.mismatchNote),
      } });
      lineMap.set(l.id, r.id);
    }

    // الاستحقاقات والتحويلات ومحاولات الاتصال
    const entMap = new Map<string, string>();
    let nEnt = 0;
    for (const e of ents) {
      const lineId = lineMap.get(e.lineId), decisionId = decMap.get(e.decId);
      if (!lineId || !decisionId || !caseCodes.has(s(e.code))) continue;
      const kind = KIND[s(e.kind)] ?? "financial";
      const attempts: Doc[] = (e.attempts ?? []).filter((a: Doc) => !a.voided);
      const unanswered = attempts.filter((a) => !a.answered).length;
      const followResult = e.followResult === "تم الصرف" ? "received" : e.followResult === "لم يتم الصرف" ? (e.noAnswer || (unanswered >= 3 && !attempts.some((a) => a.answered)) ? "no_answer" : "not_received") : "none";
      const r = await tx.entitlement.create({ data: {
        lineId, decisionId, caseCode: s(e.code), month: s(e.month), baseAmount: Number(e.base ?? e.amount) || 0, amount: Number(e.amount) || 0,
        needsConfirm: !!e.needsConfirm, confirmedAt: ts(e.confirmedAt), confirmedById: uid(e.confirmedBy), confirmNote: s(e.confirmNote),
        holdApprovedAt: ts(e.holdApproved?.at), holdApprovedReason: s(e.holdApproved?.reason),
        sentAt: e.sent ? ts(e.sentAt) ?? new Date() : null, sentById: uid(e.sentBy),
        // v1 القديم: «تم الإرسال» في المالي كان يعني التحويل · v2: التحويل له بيانات منفصلة
        legacySent: !!e.sent && kind === "financial" && !e.transfer && !e.v2,
        followResult, followAt: ts(e.followAt), notPaidReason: s(e.notPaid?.reason), notPaidAction: s(e.notPaid?.action),
        stuckReason: s(e.stuck?.reason), stuckAt: ts(e.stuck?.at), stoppedAt: ts(e.stopped?.at), stoppedReason: s(e.stopped?.reason),
        settledHow: e.settled?.how ?? (e.deferred && (e.carried ?? []).length ? "carry" : null),
        carriedAmount: (e.carried ?? []).length ? Number(e.amount) - Number(e.base ?? e.amount) : 0,
        createdAt: ts(e.createdAt) ?? new Date(), createdById: importerId,
      } });
      entMap.set(e.id, r.id);
      nEnt++;
      if (e.transfer && Number(e.transfer.amount) > 0) {
        await tx.transfer.create({ data: { entitlementId: r.id, amount: Number(e.transfer.amount), method: s(e.transfer.method) || "غير محدد", date: day(e.transfer.date) ?? new Date(), ref: s(e.transfer.ref) || `مستورد-${r.id}`, batchRef: !!e.transfer.batchRef, userId: uid(e.transfer.by), createdAt: ts(e.transfer.at) ?? new Date() } });
      }
      for (const a of attempts) {
        await tx.contactAttempt.create({ data: { entitlementId: r.id, kind: "follow", answered: !!a.answered, result: s(a.result) || (a.answered ? "رد" : "لم يرد"), note: s(a.note), userId: uid(a.by), createdAt: ts(a.at) ?? new Date() } });
      }
    }
    // المهام المفتوحة للحالات المستوردة عشان الشغل يكمل من مكانه
    const due = new Date(Date.now() + 3 * 864e5);
    const openEnts = await tx.entitlement.findMany({ where: { id: { in: [...entMap.values()] }, stoppedAt: null }, include: { line: { include: { service: true } }, transfer: true } });
    const confFor = new Set<string>();
    for (const e of openEnts) {
      if (e.needsConfirm && !e.confirmedAt && !e.sentAt && !confFor.has(e.caseCode)) {
        confFor.add(e.caseCode);
        await tx.task.create({ data: { kind: "confirm", title: "مكالمة تأكيد بيانات", opType: "مكالمة تاكيد بيانات", caseCode: e.caseCode, entitlementId: e.id, dueAt: due, createdById: importerId } });
      }
      const k = e.line.service.kind;
      const needsFollow = k === "financial" || k === "card" || e.line.service.needsFollow;
      if (e.sentAt && needsFollow && e.followResult === "none" && (k !== "financial" || e.transfer)) {
        await tx.task.create({ data: { kind: "follow", title: "مكالمة متابعة صرف", opType: "مكالمة متابعة صرف", caseCode: e.caseCode, entitlementId: e.id, dueAt: due, createdById: importerId } });
      }
    }
    for (const r of refunds) {
      const entitlementId = entMap.get(r.entId);
      if (!entitlementId) continue;
      await tx.refund.create({ data: {
        entitlementId, caseCode: s(r.code), month: s(r.month), transferAmount: Number(r.transferAmount) || Number(r.amount), amount: Number(r.amount),
        date: day(r.date) ?? new Date(), reason: s(r.reason) || "غير محدد", ref: s(r.ref), type: r.type === "جزئي" ? "partial" : "full",
        settlement: r.settlement === "تمت التسوية" ? "settled" : "pending", note: s(r.note), userId: uid(r.by), createdAt: ts(r.createdAt) ?? new Date(),
      } });
    }

    // العمليات
    let nOps = 0;
    for (const o of ops) {
      const user = uid(o.by) ?? importerId;
      const code = caseCodes.has(s(o.code)) ? s(o.code) : null;
      await tx.operation.create({ data: {
        type: s(o.type) || "عملية", team: s(o.team) || "عام", weight: Number(o.weight) || 1, caseCode: code, dept: s(o.dept) || (o.code && !code ? s(o.code) : ""),
        date: day(o.date) ?? ts(o.createdAt) ?? new Date(), status: OPST[s(o.status)] ?? "done", result: s(o.result), notes: s(o.notes), attachment: s(o.attach),
        count: Math.max(1, Number(o.count) || 1), auto: !!o.auto, userId: user, createdAt: ts(o.createdAt) ?? new Date(),
      } });
      nOps++;
    }
    await tx.auditLog.create({ data: { userId: importerId, action: "import_v1", target: "النظام السابق", meta: { cases: cases.length, decisions: decMap.size, entitlements: nEnt, operations: nOps, legacyUsers: userMap.size } } });
    return `تم الاستيراد: ${cases.length} حالة · ${decMap.size} قرار · ${lineMap.size} خدمة · ${nEnt} استحقاق · ${nOps} عملية · ${userMap.size} مستخدم سابق (موقوف).`;
  }, { timeout: 600_000, maxWait: 30_000 });
}
