import "server-only";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { lastMonths, metrics, staffStats, type Filter } from "./metrics";
import { STAGES } from "./stage";
import { fmtMonth, addMonths, currentMonth } from "./months";
import { fmtDate, fmtDur, fmtTs, pct } from "./format";
import { userNames } from "./users";
import { RENEWAL_LABELS, OP_STATUS_LABELS } from "./constants";

/** صفوف التصدير (CSV) — نفس الأرقام اللي في الشاشة */
export async function exportRows(kind: string, m: string, f: Filter, extra: Record<string, string>): Promise<{ name: string; rows: (string | number)[][] }> {
  const st = await getSettings();
  const names = await userNames();
  if (kind === "month") {
    const M = await metrics(m, f, st.followDays);
    return { name: `تقرير-${m}`, rows: [["الكود", "الاسم", "المحافظة", "الجنسية", "الخدمة", "القيمة", "الموقف", "المحوّل", "مرجع التحويل", "المسترد", "وصل للمستفيد", "محاولات المتابعة", "أرسله", "تاريخ الإرسال"],
      ...M.ents.map((e) => [e.caseCode, e.case.name, e.case.governorate, e.case.nationality, e.serviceName, e.amountN, STAGES[e.stage].label, e.transferred, e.transfer?.ref ?? "", e.refundTotal, e.received, e.attempts.length, names.name(e.sentById), fmtTs(e.sentAt)])] };
  }
  if (kind === "staff") {
    const rows = await staffStats(m, f);
    return { name: `الموظفين-${m}`, rows: [["الموظف", "مهام مسندة", "المسند المكتمل", "نسبة الإنجاز", "نفّذ بنفسه", "العمليات", "عمليات مكتملة", "متوسط زمن التنفيذ", "متأخرة", "أُرجعت", "الإنتاجية بالأوزان"],
      ...rows.map((r) => [names.name(r.uid), r.assigned, r.assignedDone, pct(r.assignedDone, r.assigned), r.doneBy, r.ops, r.opsDone, fmtDur(r.avgMs), r.late, r.returned, r.weight])] };
  }
  if (kind === "ops") {
    const [y, mo] = m.split("-").map(Number);
    const ops = await prisma.operation.findMany({ where: { date: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) }, ...(f.staff ? { userId: f.staff } : {}), ...(extra.team ? { team: extra.team } : {}), ...(extra.status ? { status: extra.status as any } : {}), ...(extra.by ? { userId: extra.by } : {}) }, orderBy: { createdAt: "asc" } });
    return { name: `العمليات-${m}`, rows: [["تاريخ التنفيذ", "العملية", "الفريق", "كود الحالة", "الجهة", "النتيجة", "الملاحظات", "العدد", "الوزن", "حالة التنفيذ", "المنفذ", "تاريخ ووقت التسجيل", "تلقائية"],
      ...ops.map((o) => [fmtDate(o.date), o.type, o.team, o.caseCode ?? "", o.dept, o.result, o.notes, o.count, Number(o.weight), OP_STATUS_LABELS[o.status], names.name(o.userId), fmtTs(o.createdAt), o.auto ? "نعم" : "لا"])] };
  }
  if (kind === "compare") {
    const ms = lastMonths(m);
    const Ms = await Promise.all(ms.map((x) => metrics(x, f, st.followDays)));
    const def: [string, (x: (typeof Ms)[number]) => number][] = [["عمليات منفذة", (x) => x.opsTotal], ["خدمات مستحقة", (x) => x.ents.length], ["حالات مستفيدة", (x) => x.beneficiaries], ["خدمات لم تُستلم", (x) => x.notReceived], ["المحوّل", (x) => x.transferred], ["المسترد", (x) => x.refunded], ["صافي المصروف", (x) => x.net], ["قرارات جديدة", (x) => x.newDecs]];
    return { name: `مقارنة-${m}`, rows: [["المؤشر", ...ms.map(fmtMonth)], ...def.map(([l, fn]) => [l, ...Ms.map(fn)])] };
  }
  if (kind === "renewal") {
    const cm = currentMonth();
    const decs = await prisma.decision.findMany({ where: { status: "active" }, include: { case: true, lines: { include: { service: true } } } });
    const view = extra.view || "soon";
    const rows = decs.map((d) => ({ d, end: d.lines.reduce((a, l) => (l.endMonth > a ? l.endMonth : a), "") })).filter(({ d, end }) =>
      view === "ended" ? end < cm : view === "sent" ? d.renewalStatus === "sent" : end >= m && end >= cm && end <= addMonths(m, st.renewLead));
    return { name: `التجديد-${view}-${m}`, rows: [["رقم القرار", "الكود", "الاسم", "الهاتف", "المحافظة", "الخدمات", "آخر شهر", "موقف التجديد"],
      ...rows.map(({ d, end }) => [d.no, d.caseCode, d.case.name, d.case.phone, d.case.governorate, d.lines.map((l) => l.service.name).join(" + "), fmtMonth(end), RENEWAL_LABELS[d.renewalStatus]])] };
  }
  throw new Error("نوع تصدير غير معروف");
}

export const toCSV = (rows: (string | number)[][]) =>
  "﻿" + rows.map((r) => r.map((c) => { const s = String(c ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\r\n");
