import "server-only";
import { randomUUID } from "node:crypto";
import type { DecisionStatus, ServiceCycle, ServiceKind } from "@prisma/client";
import { prisma } from "./prisma";
import { ActionError } from "./auth";

// استيراد شيت القرارات السنوي بعد تنظيفه بـ tools/convert-decisions-xlsx.py (format: mersal-social-decisions/1)
// - الحالات الجديدة تتسجل، والموجودة تتكمل خاناتها الفاضية بس (من غير ما يتكتب فوق أي بيان)
// - كل قرار له مفتاح ثابت: رفع نفس الملف تاني ما بيكررش حاجة
// - كله في عملية واحدة: يا ينجح كله، يا مايتحفظش أي حاجة

type InCase = Record<string, string | number | boolean | null> & { code: string; name: string };
type InLine = { service: string; beneficiary: string; amount: number; months: number; start: string; end: string; mismatchNote: string; category: string; note: string };
type InDecision = { key: string; no: string; code: string; issueDate: string; text: string; donor: string; status: DecisionStatus; stopReason: string; needsDonation: boolean; sourceStatus: string; lines: InLine[] };
type InFile = { format: string; services: { name: string; kind: ServiceKind; cycle: ServiceCycle; needsFollow: boolean }[]; cases: InCase[]; decisions: InDecision[] };

const CASE_TEXT = ["nationality", "religion", "governorate", "address", "area", "description", "phone", "unhcr", "recvMethod", "recvName", "recvPhone", "recvIdNo", "idExpiry", "residencyStatus", "residencyExpiry"] as const;
const LABEL: Record<string, string> = { nationality: "الجنسية", religion: "الديانة", governorate: "المحافظة", address: "العنوان", area: "المنطقة", description: "الوصف", phone: "هاتف", unhcr: "رقم المفوضية", recvMethod: "طريقة الاستلام", recvName: "اسم المستلم", recvPhone: "رقم الاستلام / المحفظة", recvIdNo: "الرقم القومي / إثبات الشخصية", idExpiry: "انتهاء الرقم القومي", residencyStatus: "موقف الإقامة", residencyExpiry: "انتهاء الإقامة", age: "السن", birthDate: "تاريخ الميلاد" };
const isMonth = (m: unknown) => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const chunk = <T,>(a: T[], n = 1000) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export async function importDecisionsSheet(data: InFile, importerId: string): Promise<string> {
  if (data?.format !== "mersal-social-decisions/1") throw new ActionError("الملف ده مش ملف القرارات المنظّف (decisions-import.json).");
  const STATUSES: DecisionStatus[] = ["active", "stopped", "withdrawn", "ended"];
  for (const d of data.decisions) {
    if (!d.key || !d.code || !STATUSES.includes(d.status) || !d.lines?.length) throw new ActionError(`قرار غير صالح في الملف (${d.no || d.key}).`);
    for (const l of d.lines) if (!isMonth(l.start) || !isMonth(l.end) || l.end < l.start) throw new ActionError(`تواريخ غير صالحة في قرار ${d.no}.`);
  }

  return prisma.$transaction(async (tx) => {
    // الخدمات
    const svc = new Map((await tx.service.findMany()).map((s) => [s.name, s]));
    let newSvc = 0;
    for (const s of data.services) {
      if (svc.has(s.name)) continue;
      svc.set(s.name, await tx.service.create({ data: { name: s.name, kind: s.kind, cycle: s.cycle, needsFollow: s.needsFollow, sort: 500 + newSvc } }));
      newSvc++;
    }

    // الحالات
    const existing = new Map<string, Record<string, unknown>>();
    for (const part of chunk(data.cases.map((c) => c.code))) {
      (await tx.case.findMany({ where: { code: { in: part } } })).forEach((c) => existing.set(c.code, c as unknown as Record<string, unknown>));
    }
    const fresh = data.cases.filter((c) => !existing.has(c.code));
    for (const part of chunk(fresh)) {
      await tx.case.createMany({ data: part.map((c) => ({
        code: c.code, name: String(c.name || "(بدون اسم)"), age: typeof c.age === "number" ? c.age : null, birthDate: day(c.birthDate),
        ...Object.fromEntries(CASE_TEXT.map((k) => [k, String(c[k] ?? "")])), dataConfirmed: !!c.dataConfirmed, createdById: importerId, updatedById: importerId,
      })) });
    }
    let filled = 0;
    for (const c of data.cases.filter((x) => existing.has(x.code))) {
      const old = existing.get(c.code)!;
      const patch: Record<string, unknown> = {};
      for (const k of CASE_TEXT) if (!old[k] && c[k]) patch[k] = String(c[k]);
      if (old.age == null && typeof c.age === "number") patch.age = c.age;
      if (!old.birthDate && day(c.birthDate)) patch.birthDate = day(c.birthDate);
      if (c.dataConfirmed && !old.dataConfirmed) patch.dataConfirmed = true;
      const diffs = Object.keys(patch).filter((k) => k !== "dataConfirmed").map((k) => ({ field: k, label: LABEL[k] ?? k, old: "", new: String(patch[k] instanceof Date ? (patch[k] as Date).toISOString().slice(0, 10) : patch[k]) }));
      if (!Object.keys(patch).length) continue;
      await tx.case.update({ where: { code: c.code }, data: { ...patch, updatedById: importerId } });
      if (diffs.length) await tx.caseChange.create({ data: { caseCode: c.code, userId: importerId, source: "استيراد شيت القرارات (تكملة الخانات الفاضية)", diffs } });
      filled++;
    }

    // القرارات والخدمات
    const keys = new Set<string>();
    for (const part of chunk(data.decisions.map((d) => d.key))) {
      (await tx.decision.findMany({ where: { importKey: { in: part } }, select: { importKey: true } })).forEach((d) => keys.add(d.importKey!));
    }
    const nos = new Set((await tx.decision.findMany({ select: { no: true } })).map((d) => d.no));
    const todo = data.decisions.filter((d) => !keys.has(d.key));
    const decRows: object[] = [], lineRows: object[] = [];
    for (const d of todo) {
      let no = d.no;
      while (nos.has(no)) no += "ب";
      nos.add(no);
      const id = `d${randomUUID().replace(/-/g, "").slice(0, 24)}`;
      const issue = day(d.issueDate) ?? new Date(`${d.lines[0].start}-01T00:00:00Z`);
      decRows.push({ id, no, caseCode: d.code, issueDate: issue, donor: d.donor ?? "", text: d.text ?? "", status: d.status, stopReason: d.stopReason ?? "",
        needsDonation: !!d.needsDonation, sourceStatus: d.sourceStatus ?? "", importKey: d.key, createdById: importerId });
      for (const l of d.lines) {
        const s = svc.get(l.service);
        if (!s) throw new ActionError(`الخدمة «${l.service}» مش معرّفة في الملف.`);
        lineRows.push({ id: `l${randomUUID().replace(/-/g, "").slice(0, 24)}`, decisionId: id, caseCode: d.code, serviceId: s.id, amount: Number(l.amount) || 0,
          months: Math.max(1, Math.floor(Number(l.months) || 1)), startMonth: l.start, endMonth: l.end, mismatchNote: l.mismatchNote ?? "",
          beneficiary: l.beneficiary ?? "", category: l.category ?? "", note: l.note ?? "" });
      }
    }
    for (const part of chunk(decRows)) await tx.decision.createMany({ data: part as never });
    for (const part of chunk(lineRows)) await tx.decisionLine.createMany({ data: part as never });

    const summary = { newCases: fresh.length, filledCases: filled, newDecisions: decRows.length, newLines: lineRows.length, skippedDuplicates: data.decisions.length - todo.length, newServices: newSvc };
    await tx.auditLog.create({ data: { userId: importerId, action: "import_decisions_sheet", target: "شيت القرارات", meta: summary } });
    return `تم الاستيراد: ${fresh.length} حالة جديدة · ${filled} حالة اتكملت بياناتها · ${decRows.length} قرار (${lineRows.length} خدمة)${summary.skippedDuplicates ? ` · ${summary.skippedDuplicates} قرار موجود قبل كده اتخطى` : ""}${newSvc ? ` · ${newSvc} نوع خدمة جديد` : ""}.`;
  }, { timeout: 900_000, maxWait: 30_000 });
}
