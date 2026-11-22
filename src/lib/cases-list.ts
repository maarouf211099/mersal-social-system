import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { currentMonth, fmtMonth, isMonth } from "./months";
import { recvMissing, RECV_MISSING_WHERE } from "./recv";
import { age, fmtDate } from "./format";
import { DEC_STATUS_LABELS, RENEWAL_LABELS } from "./constants";

/** قيمة «غير مسجل» في فلاتر الإقامة وطريقة الاستلام */
export const NONE = "_none";

export type CaseFilter = {
  q: string; gov: string; nat: string; data: string; status: string; svc: string; donation: string;
  start: string; end: string; res: string; recv: string;
};
export const CASE_FILTER_KEYS = ["q", "gov", "nat", "data", "status", "svc", "donation", "start", "end", "res", "recv"] as const;

export function readCaseFilter(get: (k: string) => string): CaseFilter {
  const f = Object.fromEntries(CASE_FILTER_KEYS.map((k) => [k, (get(k) ?? "").trim()])) as CaseFilter;
  if (!isMonth(f.start)) f.start = "";
  if (!isMonth(f.end)) f.end = "";
  return f;
}

/** شروط البحث: على الحالة نفسها، وعلى خدمات القرارات (اللي بتتعرض كمان) */
export function caseWhere(f: CaseFilter) {
  const cm = currentMonth();
  const lineWhere: Prisma.DecisionLineWhereInput = {
    AND: [
      ...(f.svc ? [{ serviceId: f.svc }] : []),
      ...(f.start ? [{ startMonth: f.start }] : []),
      ...(f.end ? [{ endMonth: f.end }] : []),
      ...(f.status === "active" ? [{ decision: { status: "active" as const }, endMonth: { gte: cm } }]
        : f.status === "ended" ? [{ OR: [{ decision: { status: "ended" as const } }, { decision: { status: "active" as const }, endMonth: { lt: cm } }] }]
        : f.status ? [{ decision: { status: f.status as any } }] : []),
      ...(f.donation === "1" ? [{ decision: { needsDonation: true } }] : []),
    ],
  };
  const hasLineFilter = !!(f.svc || f.status || f.donation || f.start || f.end);
  const q = f.q;
  const where: Prisma.CaseWhereInput = {
    AND: [
      q ? { OR: [{ code: { contains: q } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { recvPhone: { contains: q } }, { recvIdNo: { contains: q } }, { recvName: { contains: q, mode: "insensitive" } }, { unhcr: { contains: q } }, { decisions: { some: { no: { contains: q } } } }] } : {},
      f.gov ? { governorate: f.gov } : {},
      f.nat ? { nationality: f.nat } : {},
      f.res ? { residencyStatus: f.res === NONE ? "" : f.res } : {},
      f.recv ? { recvMethod: f.recv === NONE ? "" : f.recv } : {},
      f.data === "missing" ? RECV_MISSING_WHERE : f.data === "ok" ? { NOT: RECV_MISSING_WHERE } : {},
      hasLineFilter ? { decisions: { some: { lines: { some: lineWhere } } } } : {},
    ],
  };
  return { where, lineWhere, hasLineFilter, cm };
}

export const caseInclude = (lineWhere: Prisma.DecisionLineWhereInput | undefined) => ({
  decisions: {
    include: { lines: { where: lineWhere, include: { service: { select: { name: true } } }, orderBy: { endMonth: "desc" as const } } },
    orderBy: { issueDate: "desc" as const },
  },
}) satisfies Prisma.CaseInclude;

/** ملخص الصرف لكل حالة ولكل خدمة */
export async function paySummary(codes: string[]) {
  const byCase = new Map<string, { n: number; last: string | null; tr: number }>();
  const byLine = new Map<string, { n: number; last: string | null }>();
  for (let i = 0; i < codes.length; i += 2000) {
    const chunk = codes.slice(i, i + 2000);
    const sentWhere = { caseCode: { in: chunk }, OR: [{ sentAt: { not: null } }, { legacySent: true }] };
    const [sc, sl, tr] = await Promise.all([
      prisma.entitlement.groupBy({ by: ["caseCode"], where: sentWhere, _count: { _all: true }, _max: { month: true } }),
      prisma.entitlement.groupBy({ by: ["lineId"], where: sentWhere, _count: { _all: true }, _max: { month: true } }),
      prisma.transfer.findMany({ where: { entitlement: { caseCode: { in: chunk } } }, select: { amount: true, entitlement: { select: { caseCode: true } } } }),
    ]);
    sc.forEach((s) => byCase.set(s.caseCode, { n: s._count._all, last: s._max.month, tr: 0 }));
    sl.forEach((s) => byLine.set(s.lineId, { n: s._count._all, last: s._max.month }));
    tr.forEach((t) => {
      const c = byCase.get(t.entitlement.caseCode) ?? { n: 0, last: null, tr: 0 };
      c.tr += Number(t.amount);
      byCase.set(t.entitlement.caseCode, c);
    });
  }
  return { byCase, byLine };
}

export const lineStatus = (status: keyof typeof DEC_STATUS_LABELS, end: string, cm: string) => (status === "active" && end < cm ? "ended" : status);

/** شيت Excel شامل: صف لكل خدمة في كل قرار، ومعاه كل بيانات الحالة (حتى اللي مش ظاهرة في الشاشة) */
export async function casesSheet(f: CaseFilter) {
  const { where, lineWhere, hasLineFilter, cm } = caseWhere(f);
  const cases = await prisma.case.findMany({ where, orderBy: { code: "asc" }, include: caseInclude(hasLineFilter ? lineWhere : undefined) });
  const { byCase, byLine } = await paySummary(cases.map((c) => c.code));
  const heads = [
    "الكود", "الاسم", "النوع", "تاريخ الميلاد", "السن", "الجنسية", "الديانة", "عدد الأفراد", "المحافظة", "المنطقة", "العنوان", "الهاتف", "هاتف بديل", "رقم المفوضية", "وصف الحالة", "ملاحظات الحالة",
    "اسم المستلم", "الرقم القومي", "انتهاء الرقم القومي", "طريقة الاستلام", "رقم الاستلام / المحفظة", "الفرع / مكتب البريد", "موقف الإقامة", "تاريخ انتهاء الإقامة", "بيانات الاستلام", "بيانات مؤكدة",
    "رقم القرار", "تاريخ القرار", "المتبرع", "نص القرار", "حالة القرار", "سبب الإيقاف", "تحتاج لتبرع", "موقف التجديد",
    "الخدمة", "المستفيد", "التصنيف", "القيمة", "المدة (شهر)", "بداية القرار", "نهاية القرار", "مُدد (شهر)", "مرات صرف الخدمة", "آخر صرف للخدمة",
    "مرات الصرف للحالة", "آخر صرف للحالة", "إجمالي المحوّل للحالة",
  ];
  const rows: (string | number)[][] = [];
  for (const c of cases) {
    const miss = recvMissing(c);
    const pc = byCase.get(c.code);
    const caseCols = [
      c.code, c.name, c.gender, c.birthDate ? fmtDate(c.birthDate) : "", c.birthDate ? age(c.birthDate) ?? "" : c.age ?? "", c.nationality, c.religion, c.familySize ?? "",
      c.governorate, c.area, c.address, c.phone, c.phone2, c.unhcr, c.description, c.notes,
      c.recvName, c.recvIdNo, c.idExpiry, c.recvMethod, c.recvPhone, c.recvBranch, c.residencyStatus, c.residencyExpiry,
      miss.length ? `ناقصة: ${miss.join("، ")}` : "مكتملة", c.dataConfirmed ? "نعم" : "لا",
    ];
    const tail = [pc?.n ?? 0, pc?.last ? fmtMonth(pc.last) : "", pc?.tr ?? 0];
    const lines = c.decisions.flatMap((d) => d.lines.map((l) => ({ d, l })));
    if (!lines.length) { rows.push([...caseCols, ...Array(18).fill(""), ...tail]); continue; }
    for (const { d, l } of lines) {
      const pl = byLine.get(l.id);
      rows.push([
        ...caseCols,
        d.no, fmtDate(d.issueDate), d.donor, d.text, DEC_STATUS_LABELS[l.stoppedAt ? "stopped" : lineStatus(d.status, l.endMonth, cm)], l.stopReason || d.stopReason, d.needsDonation ? "نعم" : "", RENEWAL_LABELS[d.renewalStatus],
        l.service.name, l.beneficiary, l.category, Number(l.amount), l.months, fmtMonth(l.startMonth), fmtMonth(l.endMonth), l.extendedBy || "",
        pl?.n ?? 0, pl?.last ? fmtMonth(pl.last) : "",
        ...tail,
      ]);
    }
  }
  return { rows: [heads, ...rows], cases: cases.length };
}
