import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { TASK_KIND_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtTs } from "@/lib/format";
import { completeAction } from "@/actions/cycle";
import { returnTask, updateTaskStatus } from "@/actions/tasks";
import { Badge, CaseLink, PageHead } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePageUser();
  const { id } = await params;
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) notFound();
  const names = await userNames();
  const open = ["new", "in_progress", "stuck"].includes(t.status);
  const c = t.caseCode ? await prisma.case.findUnique({ where: { code: t.caseCode }, select: { name: true } }) : null;
  const kv = (l: string, v: React.ReactNode) => <div><span>{l}</span>{v || "—"}</div>;
  return (
    <>
      <PageHead title={t.title} sub={`${TASK_KIND_LABELS[t.kind]} · ${t.status === "cancelled" ? "ملغاة" : TASK_STATUS_LABELS[t.status]}`}>
        <Link className="btn secondary" href="/tasks">كل المهام</Link>
      </PageHead>
      <div className="card">
        <div className="kv">
          {kv("الحالة", t.caseCode ? <CaseLink code={t.caseCode} name={c?.name} /> : "")}{kv("مسندة إلى", names.name(t.assigneeId))}
          {kv("أنشأها", `${names.name(t.createdById)} · ${fmtTs(t.createdAt)}`)}{kv("الموعد النهائي", fmtTs(t.dueAt))}
          {kv("نفّذها", t.completedById ? `${names.name(t.completedById)} · ${fmtTs(t.completedAt)}` : "")}{kv("النتيجة", t.result)}
        </div>
        {t.notes && <p className="muted" style={{ marginTop: 10 }}>{t.notes}</p>}
        {t.returnNote && <div className="alert warn" style={{ marginTop: 10 }}>أُرجعت للتصحيح ({t.returnedCount}): {t.returnNote}</div>}
      </div>
      {t.entitlementId && t.kind !== "action" && open && <div className="alert">هذه المهمة تُنفذ من صفحة الاستحقاق: <Link className="strong" href={`/cycle/${t.entitlementId}`}>فتح الاستحقاق وتنفيذ المطلوب</Link></div>}
      {t.kind === "action" && open && can(u.role, "task") && (
        <div className="card"><div className="card-title"><h2>إغلاق مهمة المعالجة</h2></div>
          <ActionForm action={completeAction}><input type="hidden" name="taskId" value={t.id} />
            <label className="field"><span>ما تم تنفيذه *</span><textarea name="result" required /></label>
            <div className="inline"><Submit>إغلاق المهمة</Submit>{t.entitlementId && <Link className="btn secondary" href={`/cycle/${t.entitlementId}`}>الاستحقاق</Link>}</div>
          </ActionForm>
        </div>
      )}
      {t.kind === "manual" && open && can(u.role, "task") && (
        <div className="card"><div className="card-title"><h2>تحديث المهمة</h2></div>
          <ActionForm action={updateTaskStatus}><input type="hidden" name="id" value={t.id} />
            <label className="field"><span>نتيجة التنفيذ (إلزامية للإغلاق)</span><textarea name="result" defaultValue={t.result} /></label>
            <div className="inline">
              {t.status === "new" && <Submit className="btn secondary" name="status" value="in_progress">بدء التنفيذ</Submit>}
              <Submit name="status" value="done">إغلاق كمكتملة</Submit>
              <Submit className="btn danger" name="status" value="stuck">متعثرة</Submit>
            </div>
          </ActionForm>
        </div>
      )}
      {t.status === "done" && can(u.role, "return") && (
        <div className="card"><div className="card-title"><h2>إرجاع للتصحيح</h2><Badge tone="warn">تُحسب على من نفّذها</Badge></div>
          <ActionForm action={returnTask}><input type="hidden" name="id" value={t.id} />
            <label className="field"><span>ما الذي يحتاج تصحيحاً؟ *</span><input name="note" required /></label>
            <div><Submit className="btn danger">إرجاع</Submit></div>
          </ActionForm>
        </div>
      )}
    </>
  );
}
