import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { loadEnts, type Ent } from "./entitlements";
import { getSettings } from "./settings";
import { STAGES, type Stage } from "./stage";
import { fmtMonth } from "./months";
import { fmtTs } from "./format";

export type CycleFilter = { m: string; kind: string; svc?: string; stage?: string; q?: string; batch?: string; data?: string };

/** نفس القائمة في شاشة دورة الصرف وفي شيت الإكسيل */
export async function cycleList(f: CycleFilter) {
  const st = await getSettings();
  const where: Prisma.EntitlementWhereInput = f.batch
    ? { batchId: f.batch }
    : { month: f.m, line: { service: { kind: f.kind as any, ...(f.svc ? { id: f.svc } : {}) } } };
  const all = await loadEnts(where, st.followDays);
  const q = (f.q ?? "").trim();
  const list = all.filter((e) =>
    (!f.stage || e.stage === f.stage)
    && (!f.data || (f.data === "missing" ? e.missing.length > 0 : e.missing.length === 0))
    && (!q || e.caseCode.includes(q) || e.case.name.includes(q) || e.case.phone.includes(q) || e.case.recvIdNo.includes(q)));
  return { all, list };
}

export const CYCLE_HEADS = ["الكود", "الاسم", "رقم الهاتف", "اسم المستلم", "الرقم القومي", "موقف الإقامة", "تاريخ انتهاء الإقامة", "الخدمة", "التكلفة", "القرار", "تاريخ بداية القرار", "تاريخ نهاية القرار",
  "المستفيد", "طريقة الاستلام", "رقم الاستلام / المحفظة", "رقم القرار", "حالة البيانات", "الموقف", "الدفعة", "تاريخ الإرسال"];

export function cycleRow(e: Ent, batchCode = ""): (string | number)[] {
  return [
    e.caseCode, e.case.name, e.case.phone, e.case.recvName, e.case.recvIdNo, e.case.residencyStatus, e.case.residencyExpiry,
    e.serviceName, e.amountN, e.line.decision.text, fmtMonth(e.line.startMonth), fmtMonth(e.line.endMonth),
    e.line.beneficiary, e.case.recvMethod, e.case.recvPhone, e.line.decision.no,
    e.missing.length ? `ناقصة: ${e.missing.join("، ")}` : "مكتملة", STAGES[e.stage as Stage].label, batchCode, e.sentAt ? fmtTs(e.sentAt) : "",
  ];
}

export async function batchCodes(ids: (string | null)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return new Map<string, string>();
  const bs = await prisma.paymentBatch.findMany({ where: { id: { in: list } }, select: { id: true, code: true } });
  return new Map(bs.map((b) => [b.id, b.code]));
}
