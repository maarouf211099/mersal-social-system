import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { caseNamesFor } from "@/lib/cases";
import { getSettings } from "@/lib/settings";
import { one, qs, type SP } from "@/lib/page";
import { assignTasks, createTask } from "@/actions/tasks";
import { Badge, PageHead, Seg } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { TaskForm } from "@/components/TaskForm";
import { Icon } from "@/components/icons";
import { TaskTable } from "@/components/TaskTable";

const OPEN = { in: ["new", "in_progress"] as ("new" | "in_progress")[] };

export default async function TasksPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const view = one(sp.view) || "open", q = one(sp.q).trim(), who = one(sp.who);
  const now = new Date();
  const st = await getSettings();
  const base: Prisma.TaskWhereInput = {
    ...(q ? { OR: [{ caseCode: { contains: q } }, { title: { contains: q, mode: "insensitive" } }] } : {}),
    ...(who ? { assigneeId: who } : {}),
  };
  const byView: Record<string, Prisma.TaskWhereInput> = {
    open: { status: OPEN }, unassigned: { status: OPEN, assigneeId: null }, late: { status: OPEN, dueAt: { lt: now } },
    stuck: { status: "stuck" }, done: { status: "done" }, mine: { status: OPEN, assigneeId: u.id },
  };
  const showForm = one(sp.new) === "1" || can(u.role, "assign");
  const [rows, names, load, ops] = await Promise.all([
    prisma.task.findMany({ where: { ...base, ...(byView[view] ?? byView.open) }, orderBy: view === "done" ? { completedAt: "desc" } : [{ dueAt: "asc" }], take: 500 }),
    userNames(),
    prisma.task.groupBy({ by: ["assigneeId"], where: { status: OPEN }, _count: true }),
    prisma.opType.findMany({ where: { isActive: true, auto: false }, orderBy: { sort: "asc" }, select: { name: true, team: true } }),
  ]);
  const lateBy = await prisma.task.groupBy({ by: ["assigneeId"], where: { status: OPEN, dueAt: { lt: now } }, _count: true });
  const caseNames = await caseNamesFor(rows.map((t) => t.caseCode));
  const views = [["open", "كل المفتوحة"], ["mine", "مهامي"], ["unassigned", "غير مسندة"], ["late", "المتأخرة"], ["stuck", "المتعثرة"], ["done", "المكتملة"]];
  return (
    <>
      <PageHead title="توزيع المهام" sub={`أضف مهمة من أنواع العمليات وأسندها لموظف أو أكتر بمدة. مهام التأكيد والمتابعة والمعالجة بتتعمل تلقائياً من دورة الصرف (تأكيد ${st.confirmDays} · متابعة ${st.followDays} · معالجة ${st.actionDays} أيام).`}>
        {can(u.role, "task") && <a className="btn primary" href="#new"><Icon.plus /> مهمة جديدة</a>}
      </PageHead>
      {can(u.role, "task") && (
        <details className="box new-task" id="new" open={showForm}>
          <summary>{can(u.role, "assign") ? "إضافة مهمة وإسنادها" : "إضافة مهمة لنفسي"}</summary>
          <div style={{ marginTop: 12 }}>
            <TaskForm ops={ops} people={names.active.map((x) => ({ id: x.id, name: x.name, team: x.team }))} canAssign={can(u.role, "assign")} me={{ id: u.id, name: u.name }} />
          </div>
        </details>
      )}
      <div className="inline" style={{ marginBottom: 12 }}>
        <span className="muted">الحِمل الحالي:</span>
        {load.length ? load.map((l) => { const late = lateBy.find((x) => x.assigneeId === l.assigneeId)?._count ?? 0; return <a key={l.assigneeId ?? "none"} href={`/tasks${qs({ view: "open", who: l.assigneeId ?? undefined })}`}><Badge tone={l.assigneeId ? "" : "warn"} plain>{l.assigneeId ? names.name(l.assigneeId) : "غير مسندة"} · {l._count}{late ? ` · ${late} متأخرة` : ""}</Badge></a>; }) : <span className="muted">لا مهام مفتوحة</span>}
      </div>
      <div className="toolbar">
        <Seg current={view} items={views.map(([k, l]) => ({ key: k, label: l, href: `/tasks${qs({ view: k, q })}` }))} />
        <form className="inline"><input type="hidden" name="view" value={view} /><input type="search" name="q" defaultValue={q} placeholder="كود أو عنوان" style={{ width: 200 }} /></form>
      </div>
      <ActionForm action={assignTasks} resetOnOk>
        <div className="card">
          {can(u.role, "assign") && (
            <div className="toolbar">
              <label className="field"><span>إسناد المحدد إلى</span><select name="to" defaultValue=""><option value="">اختار موظفاً</option>{names.active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <div className="auto"><Submit className="btn primary">إسناد</Submit></div>
            </div>
          )}
          <TaskTable rows={rows} names={names} caseNames={caseNames} selectable={can(u.role, "assign")} empty="لا توجد مهام في هذا العرض." />
        </div>
      </ActionForm>
    </>
  );
}
