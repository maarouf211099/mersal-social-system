import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { loadEnts, type Ent } from "./entitlements";
import { addMonths, currentMonth, monthRange } from "./months";
import { FINAL, NOT_RECEIVED, type Stage } from "./stage";

// كل المؤشرات محسوبة من السجلات الفعلية (الاستحقاقات، التحويلات، الاستردادات، المهام، العمليات)
export type Filter = { staff?: string; svc?: string; dec?: string; gov?: string; nat?: string };

const dayRange = (m: string) => { const [y, mo] = m.split("-").map(Number); return { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) }; };
const caseWhere = (f: Filter): Prisma.CaseWhereInput => ({ ...(f.gov ? { governorate: f.gov } : {}), ...(f.nat ? { nationality: f.nat } : {}) });
const hasCaseF = (f: Filter) => !!(f.gov || f.nat);

function effStatus(status: string, end: string) { return status === "active" && end < currentMonth() ? "ended" : status; }

export async function monthEnts(m: string, f: Filter, followDays: number): Promise<Ent[]> {
  const ents = await loadEnts({
    month: m,
    ...(f.svc ? { line: { serviceId: f.svc } } : {}),
    ...(hasCaseF(f) ? { case: caseWhere(f) } : {}),
  }, followDays);
  let out = ents;
  if (f.dec) {
    const ends = new Map((await prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decisionId: { in: [...new Set(ents.map((e) => e.decisionId))] } }, _max: { endMonth: true } })).map((g) => [g.decisionId, g._max.endMonth ?? ""]));
    out = out.filter((e) => effStatus(e.line.decision.status, ends.get(e.decisionId) ?? "") === f.dec);
  }
  if (f.staff) out = out.filter((e) => e.sentById === f.staff || e.transfer?.userId === f.staff || e.confirmedById === f.staff || e.attempts.some((a) => a.userId === f.staff));
  return out;
}

export async function metrics(m: string, f: Filter, followDays: number) {
  const r = monthRange(m), d = dayRange(m);
  const ents = await monthEnts(m, f, followDays);
  const fin = ents.filter((e) => e.kind === "financial");
  const opWhere: Prisma.OperationWhereInput = { date: d, ...(f.staff ? { userId: f.staff } : {}), ...(hasCaseF(f) ? { OR: [{ caseCode: null }, { case: caseWhere(f) }] } : {}) };
  const [ops, tasks, lateNow, refunds, decs, activeLines] = await Promise.all([
    prisma.operation.findMany({ where: opWhere, select: { type: true, status: true, count: true, weight: true, userId: true, returnedCount: true } }),
    prisma.task.findMany({ where: { createdAt: r, status: { not: "cancelled" }, ...(f.staff ? { OR: [{ assigneeId: f.staff }, { completedById: f.staff }] } : {}) } }),
    prisma.task.count({ where: { status: { in: ["new", "in_progress"] }, dueAt: { lt: new Date() }, ...(f.staff ? { assigneeId: f.staff } : {}) } }),
    prisma.refund.findMany({ where: { month: m, ...(f.svc ? { entitlement: { line: { serviceId: f.svc } } } : {}), ...(hasCaseF(f) ? { entitlement: { case: caseWhere(f) } } : {}) } }),
    prisma.decision.findMany({ where: { ...(hasCaseF(f) ? { case: caseWhere(f) } : {}), ...(f.svc ? { lines: { some: { serviceId: f.svc } } } : {}) }, select: { status: true, issueDate: true, stoppedAt: true, renewalAt: true, renewalStatus: true, caseCode: true, lines: { select: { endMonth: true } } } }),
    prisma.decisionLine.findMany({ where: { decision: { status: "active" }, startMonth: { lte: m }, endMonth: { gte: m }, ...(f.svc ? { serviceId: f.svc } : {}), ...(hasCaseF(f) ? { decision: { status: "active", case: caseWhere(f) } } : {}) }, select: { caseCode: true } }),
  ]);
  const cnt = (o: { count: number }) => o.count || 1;
  const sum = <T,>(a: T[], fn: (x: T) => number) => a.reduce((s, x) => s + fn(x), 0);
  const stages: Partial<Record<Stage, number>> = {};
  ents.forEach((e) => (stages[e.stage] = (stages[e.stage] ?? 0) + 1));
  const bySvc = new Map<string, { n: number; sent: number; done: number; open: number; amount: number; kind: string }>();
  ents.forEach((e) => {
    const b = bySvc.get(e.serviceName) ?? { n: 0, sent: 0, done: 0, open: 0, amount: 0, kind: e.kind };
    b.n++; b.amount += e.amountN; if (e.sentAt || e.legacySent) b.sent++;
    if (FINAL.includes(e.stage)) b.done++; else if (e.stage !== "stop") b.open++;
    bySvc.set(e.serviceName, b);
  });
  const reasons = new Map<string, number>();
  const bump = (k: string) => reasons.set(k, (reasons.get(k) ?? 0) + 1);
  ents.forEach((e) => {
    if (e.notPaidReason) bump(e.notPaidReason);
    if (e.stuckReason) bump(`متعثر: ${e.stuckReason}`);
    if (e.followResult === "no_answer") bump("عدم الرد بعد 3 محاولات");
  });
  refunds.forEach((x) => bump(`استرداد: ${x.reason}`));
  const transferred = sum(fin, (e) => e.transferred), refunded = sum(refunds, (x) => Number(x.amount));
  const final = ents.filter((e) => FINAL.includes(e.stage));
  const decEnd = (x: (typeof decs)[number]) => x.lines.reduce((a, l) => (l.endMonth > a ? l.endMonth : a), "");
  const inMonth = (dt: Date | null) => !!dt && dt >= r.gte && dt < r.lt;
  return {
    m, ents, stages, bySvc: [...bySvc.entries()], reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
    opsTotal: sum(ops, cnt), opsDone: sum(ops.filter((o) => o.status === "done"), cnt), opsOpen: sum(ops.filter((o) => o.status !== "done"), cnt),
    followOps: sum(ops.filter((o) => /متابعة/.test(o.type)), cnt), deliveryOps: sum(ops.filter((o) => /تسليم/.test(o.type)), cnt),
    tasksCreated: tasks.length, tasksLate: tasks.filter((t) => (t.completedAt ? t.completedAt > t.dueAt : t.dueAt < new Date())).length, lateNow,
    due: sum(fin, (e) => e.amountN), transferred, refunded, net: transferred - refunded,
    transferredCases: new Set(fin.filter((e) => e.transferred > 0).map((e) => e.caseCode)).size,
    notRecvFin: new Set(fin.filter((e) => NOT_RECEIVED.includes(e.stage)).map((e) => e.caseCode)).size,
    beneficiaries: new Set(final.map((e) => e.caseCode)).size, received: final.length,
    notReceived: ents.filter((e) => NOT_RECEIVED.includes(e.stage)).length,
    incomplete: ents.filter((e) => !FINAL.includes(e.stage) && e.stage !== "stop"),
    activeCases: new Set(activeLines.map((l) => l.caseCode)).size,
    newDecs: decs.filter((x) => inMonth(x.issueDate)).length,
    endingDecs: decs.filter((x) => x.status === "active" && decEnd(x) === m).length,
    stoppedDecs: decs.filter((x) => ["stopped", "withdrawn"].includes(x.status) && inMonth(x.stoppedAt)).length,
    stoppedTotal: decs.filter((x) => ["stopped", "withdrawn"].includes(x.status)).length,
    referred: decs.filter((x) => x.renewalStatus !== "none" && inMonth(x.renewalAt)).length,
  };
}
export type Metrics = Awaited<ReturnType<typeof metrics>>;

export type StaffRow = {
  uid: string; assigned: number; assignedDone: number; doneBy: number; late: number; returned: number; avgMs: number | null;
  ops: number; opsDone: number; weight: number; byType: [string, number][];
};

/** إنتاجية الموظفين: المسند إليه مقابل ما نفّذه فعلاً بنفسه */
export async function staffStats(m: string, f: Filter = {}): Promise<StaffRow[]> {
  const r = monthRange(m), d = dayRange(m);
  const caseF = hasCaseF(f) ? { OR: [{ caseCode: null }, { case: caseWhere(f) }] } : {};
  const [assigned, done, ops, returnedTasks] = await Promise.all([
    prisma.task.findMany({ where: { createdAt: r, assigneeId: { not: null }, status: { not: "cancelled" } } }),
    prisma.task.findMany({ where: { completedAt: r, completedById: { not: null } } }),
    prisma.operation.findMany({ where: { date: d, ...caseF }, select: { userId: true, type: true, status: true, count: true, weight: true, returnedCount: true } }),
    prisma.task.findMany({ where: { returnedToId: { not: null }, createdAt: { lt: r.lt } }, select: { returnedToId: true, returnedCount: true, createdAt: true } }),
  ]);
  const ids = new Set<string>([...assigned.map((t) => t.assigneeId!), ...done.map((t) => t.completedById!), ...ops.map((o) => o.userId)]);
  if (f.staff) [...ids].forEach((i) => i !== f.staff && ids.delete(i));
  const now = new Date();
  return [...ids].map((uid) => {
    const a = assigned.filter((t) => t.assigneeId === uid), dn = done.filter((t) => t.completedById === uid);
    const my = ops.filter((o) => o.userId === uid);
    const times = dn.map((t) => t.completedAt!.getTime() - t.createdAt.getTime()).filter((x) => x >= 0);
    const byType = new Map<string, number>();
    my.forEach((o) => byType.set(o.type, (byType.get(o.type) ?? 0) + (o.count || 1)));
    return {
      uid, assigned: a.length, assignedDone: a.filter((t) => t.status === "done").length, doneBy: dn.length,
      late: a.filter((t) => (t.completedAt ? t.completedAt > t.dueAt : t.dueAt < now && t.status !== "stuck")).length,
      returned: my.reduce((s, o) => s + o.returnedCount, 0) + returnedTasks.filter((t) => t.returnedToId === uid && t.createdAt >= r.gte).reduce((s, t) => s + t.returnedCount, 0),
      avgMs: times.length ? times.reduce((s, x) => s + x, 0) / times.length : null,
      ops: my.reduce((s, o) => s + (o.count || 1), 0), opsDone: my.filter((o) => o.status === "done").reduce((s, o) => s + (o.count || 1), 0),
      weight: Math.round(my.reduce((s, o) => s + Number(o.weight) * (o.count || 1), 0) * 10) / 10,
      byType: [...byType.entries()].sort((x, y) => y[1] - x[1]),
    };
  }).sort((x, y) => y.weight - x.weight);
}

export const lastMonths = (m: string, n = 6) => Array.from({ length: n }, (_, i) => addMonths(m, i - n + 1));
