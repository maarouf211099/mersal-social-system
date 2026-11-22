import "server-only";
import { prisma } from "./prisma";
import { loadEnts, type Ent } from "./entitlements";
import { getSettings } from "./settings";
import { addMonths, currentMonth, fmtMonth } from "./months";
import { fmtTs } from "./format";
import { userNames } from "./users";

/**
 * شهر «ما اتوصلناش فيه للحالة»:
 * - المتابعة خلصت 3 محاولات بدون رد، أو
 * - الشهر ما اتبعتش (اتأجل) وعدّى، أو ما اتبعتش ومكالمات البيانات خلصت 3 محاولات بدون رد.
 */
function unreached(e: Ent, cm: string, dataNoAnswer: number) {
  if (e.stoppedAt || e.followResult === "received" || e.followResult === "not_received") return "";
  if (e.followResult === "no_answer") return "المتابعة: 3 محاولات بدون رد";
  const sent = e.sentAt || e.legacySent;
  if (!sent && e.month < cm) return "اتأجل وما اتبعتش";
  if (!sent && dataNoAnswer >= 3) return "مكالمات البيانات: 3 محاولات بدون رد";
  return "";
}

export type ClosingRow = {
  lineId: string; caseCode: string; name: string; phone: string; service: string; beneficiary: string;
  decisionId: string; decisionNo: string; decisionText: string; months: { month: string; why: string }[];
  attempts: { at: Date; kind: string; result: string; by: string }[];
};

/** خدمات (مش قرارات) ما اتوصلناش فيها للحالة شهرين ورا بعض — مرشحة للغلق */
export async function closingCandidates(): Promise<ClosingRow[]> {
  const st = await getSettings();
  const cm = currentMonth();
  const ents = await loadEnts({
    month: { gte: addMonths(cm, -3), lte: addMonths(cm, 1) }, // الشهر الجاي بيتولّد بدري (قفل الشهر يوم 15)
    line: { stoppedAt: null, decision: { status: "active" } },
  }, st.followDays, [{ month: "desc" }]);
  if (!ents.length) return [];
  // محاولات البيانات بدون رد ورا بعض (من آخر محاولة) لكل حالة
  const codes = [...new Set(ents.map((e) => e.caseCode))];
  const conf = await prisma.contactAttempt.findMany({
    where: { kind: "confirm", voided: false, entitlement: { caseCode: { in: codes } }, createdAt: { gte: new Date(Date.now() - 120 * 864e5) } },
    select: { answered: true, entitlement: { select: { caseCode: true } } }, orderBy: { createdAt: "desc" },
  });
  const dataNA = new Map<string, number>();
  const stop = new Set<string>();
  for (const a of conf) {
    const c = a.entitlement.caseCode;
    if (stop.has(c)) continue;
    if (a.answered) stop.add(c);
    else dataNA.set(c, (dataNA.get(c) ?? 0) + 1);
  }
  const byLine = new Map<string, Ent[]>();
  ents.forEach((e) => byLine.set(e.lineId, [...(byLine.get(e.lineId) ?? []), e]));
  const hits: { list: Ent[]; months: { month: string; why: string }[] }[] = [];
  for (const list of byLine.values()) {
    const byMonth = new Map(list.map((e) => [e.month, e]));
    for (const e of list) {
      const prev = byMonth.get(addMonths(e.month, -1));
      if (!prev) continue;
      const w1 = unreached(prev, cm, dataNA.get(e.caseCode) ?? 0), w2 = unreached(e, cm, dataNA.get(e.caseCode) ?? 0);
      if (w1 && w2) { hits.push({ list, months: [{ month: prev.month, why: w1 }, { month: e.month, why: w2 }] }); break; }
    }
  }
  if (!hits.length) return [];
  const names = await userNames();
  const attempts = await prisma.contactAttempt.findMany({
    where: { voided: false, entitlementId: { in: hits.flatMap((h) => h.list.map((e) => e.id)) } },
    orderBy: { createdAt: "asc" },
  });
  return hits.map(({ list, months }) => {
    const e = list[0];
    const ids = new Set(list.map((x) => x.id));
    return {
      lineId: e.lineId, caseCode: e.caseCode, name: e.case.name, phone: e.case.phone, service: e.serviceName, beneficiary: e.line.beneficiary,
      decisionId: e.line.decision.id, decisionNo: e.line.decision.no, decisionText: e.line.decision.text, months,
      attempts: attempts.filter((a) => ids.has(a.entitlementId)).map((a) => ({ at: a.createdAt, kind: a.kind === "confirm" ? "بيانات" : "متابعة", result: a.result, by: names.name(a.userId) })),
    };
  }).sort((a, b) => a.caseCode.localeCompare(b.caseCode));
}

/** الخدمات اللي اتقفلت في شهر (للإثبات في الإيميل) */
export async function closedLines(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return prisma.decisionLine.findMany({
    where: { stoppedAt: { gte: new Date(Date.UTC(y, mo - 1, 1) - 2 * 3600e3), lt: new Date(Date.UTC(y, mo, 1) - 2 * 3600e3) } },
    include: { service: true, decision: { include: { case: true } } }, orderBy: { stoppedAt: "desc" },
  });
}

export function closingSheet(rows: ClosingRow[]) {
  return [
    ["الكود", "الاسم", "رقم الهاتف", "الخدمة", "المستفيد", "رقم القرار", "نص القرار", "الشهور", "سبب الترشيح", "محاولات الاتصال (التاريخ · النوع · النتيجة · الموظف)"],
    ...rows.map((r) => [r.caseCode, r.name, r.phone, r.service, r.beneficiary, r.decisionNo, r.decisionText,
      r.months.map((x) => fmtMonth(x.month)).join(" + "), r.months.map((x) => `${fmtMonth(x.month)}: ${x.why}`).join(" · "),
      r.attempts.map((a) => `${fmtTs(a.at)} · ${a.kind} · ${a.result} · ${a.by}`).join("\n")]),
  ];
}
