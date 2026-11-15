import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userNames } from "@/lib/users";
import { caseNamesFor } from "@/lib/cases";
import { staffStats } from "@/lib/metrics";
import { currentMonth, fmtMonth } from "@/lib/months";
import { fmtDur } from "@/lib/format";
import { Kpi, PageHead } from "@/components/ui";
import { TaskTable } from "@/components/TaskTable";

export default async function MyPage() {
  const u = await requirePageUser();
  const m = currentMonth();
  const [open, done, unassigned, names, stats] = await Promise.all([
    prisma.task.findMany({ where: { assigneeId: u.id, status: { in: ["new", "in_progress", "stuck"] } }, orderBy: { dueAt: "asc" } }),
    prisma.task.findMany({ where: { completedById: u.id }, orderBy: { completedAt: "desc" }, take: 20 }),
    prisma.task.count({ where: { assigneeId: null, status: { in: ["new", "in_progress"] } } }),
    userNames(),
    staffStats(m, { staff: u.id }),
  ]);
  const s = stats[0];
  const late = open.filter((t) => t.dueAt < new Date() && t.status !== "stuck").length;
  const caseNames = await caseNamesFor([...open, ...done].map((t) => t.caseCode));
  return (
    <>
      <PageHead title={`مهامي · ${u.name}`} sub={`ما هو مطلوب منك الآن ومؤشراتك في ${fmtMonth(m)}`} />
      <div className="kpis">
        <Kpi v={open.length} l="مهام مفتوحة لي" />
        <Kpi v={late} l="متأخرة" tone={late ? "bad" : ""} />
        <Kpi v={s?.doneBy ?? 0} l="نفّذتها هذا الشهر" tone="ok" />
        <Kpi v={s?.ops ?? 0} l="عملياتي المسجلة" />
        <Kpi v={fmtDur(s?.avgMs ?? null)} l="متوسط زمن التنفيذ" />
        <Kpi v={s?.returned ?? 0} l="أُرجعت للتصحيح" tone={s?.returned ? "warn" : ""} />
      </div>
      {unassigned > 0 && <div className="alert warn">{unassigned} مهمة غير مسندة لأحد. <Link className="strong" href="/tasks?view=unassigned">عرض</Link></div>}
      <div className="section-title"><h2>مطلوب مني</h2></div>
      <div className="card"><TaskTable rows={open} names={names} caseNames={caseNames} empty="لا توجد مهام مفتوحة لك. المهام تُنشأ تلقائياً من دورة الصرف أو يسندها المشرف." /></div>
      <div className="section-title"><h2>آخر ما أنجزته</h2></div>
      <div className="card"><TaskTable rows={done} names={names} caseNames={caseNames} empty="لا يوجد بعد." /></div>
    </>
  );
}
