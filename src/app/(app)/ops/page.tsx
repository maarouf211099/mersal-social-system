import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { OP_STATUS_LABELS, TEAMS } from "@/lib/constants";
import { fmtDate, fmtTs } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { createOperation, returnOperation, setOperationStatus } from "@/actions/tasks";
import { Badge, CaseLink, PageHead, Table } from "@/components/ui";
import { AutoSubmitSelect, MonthSelect } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";
import { ACCEPT } from "@/lib/files";

export default async function OpsPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), team = one(sp.team), status = one(sp.status), by = one(sp.by), q = one(sp.q).trim(), code = one(sp.code);
  const [y, mo] = m.split("-").map(Number);
  const where: Prisma.OperationWhereInput = {
    date: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) },
    ...(team ? { team } : {}), ...(status ? { status: status as any } : {}), ...(by ? { userId: by } : {}),
    ...(q ? { OR: [{ type: { contains: q } }, { caseCode: { contains: q } }, { dept: { contains: q } }, { result: { contains: q } }] } : {}),
  };
  const [rows, total, types, names] = await Promise.all([
    prisma.operation.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: { case: { select: { name: true } }, attachments: { select: { id: true, name: true } } } }),
    prisma.operation.aggregate({ where, _sum: { count: true } }),
    prisma.opType.findMany({ where: { isActive: true, auto: false }, orderBy: { sort: "asc" } }),
    userNames(),
  ]);
  const weight = rows.reduce((s, o) => s + Number(o.weight) * o.count, 0);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHead title="سجل العمليات" sub="كل إجراء على الحالات يُسجَّل هنا باسم المنفذ وتاريخ ووقت التسجيل تلقائياً — سواء سجّله الموظف أو سجّله النظام مع خطوات دورة الصرف.">
        <MonthSelect value={m} options={monthOpts(m)} />
        <Link className="btn secondary" href={`/api/export/ops${qs({ m, team, status, by, q })}`}><Icon.download /> CSV</Link>
      </PageHead>
      {can(u.role, "op") && (
        <details className="box" id="new" open={!!code} style={{ marginBottom: 14 }}><summary>+ تسجيل عملية</summary>
          <ActionForm action={createOperation} resetOnOk>
            <div className="fgrid" style={{ marginTop: 10 }}>
              <label className="field" style={{ gridColumn: "span 2" }}><span>نوع العملية *</span><select name="typeId" required defaultValue="">
                <option value="">اختار</option>
                {TEAMS.map((t) => <optgroup key={t} label={t}>{types.filter((x) => x.team === t).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.scope === "case" ? "حالة" : "عامة"} · وزن {Number(x.weight)}</option>)}</optgroup>)}
              </select></label>
              <label className="field"><span>تاريخ التنفيذ</span><input type="date" name="date" defaultValue={today} /></label>
              <label className="field"><span>كود الحالة (لعمليات الحالات)</span><input name="caseCode" defaultValue={code} dir="ltr" /></label>
              <label className="field"><span>الجهة / الإدارة (للعمليات العامة)</span><input name="dept" placeholder="مثال: إدارة الحسابات" /></label>
              <label className="field"><span>حالة التنفيذ</span><select name="status" defaultValue="done"><option value="done">تم</option><option value="in_progress">جاري</option><option value="new">جديد</option></select></label>
              <label className="field"><span>النتيجة</span><input name="result" placeholder="مثال: تم الرد وتأكيد العنوان" /></label>
              <label className="field"><span>عدد المرات</span><input type="number" name="count" min={1} defaultValue={1} /></label>
              <label className="field"><span>رابط / رقم مستند</span><input name="attachment" dir="ltr" /></label>
              <label className="field"><span>مرفق (ملف)</span><input type="file" name="file" accept={ACCEPT} /></label>
            </div>
            <label className="field"><span>ملاحظات</span><textarea name="notes" /></label>
            <div className="inline"><Submit>حفظ العملية</Submit><span className="muted">يُسجَّل اسمك وتاريخ ووقت التسجيل تلقائياً.</span></div>
          </ActionForm>
        </details>
      )}
      <form className="toolbar">
        <input type="hidden" name="m" value={m} />
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="نوع، كود، جهة، نتيجة" /></label>
        <label className="field"><span>الفريق</span><AutoSubmitSelect name="team" defaultValue={team}><option value="">الكل</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الحالة</span><AutoSubmitSelect name="status" defaultValue={status}><option value="">الكل</option>{Object.entries(OP_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>المنفذ</span><AutoSubmitSelect name="by" defaultValue={by}><option value="">الكل</option>{names.all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</AutoSubmitSelect></label>
      </form>
      <div className="card">
        <p className="muted" style={{ marginBottom: 10 }}>{total._sum.count ?? 0} عملية · الإنتاجية بالأوزان {Math.round(weight * 10) / 10}{rows.length === 500 ? " · يُعرض آخر 500" : ""}</p>
        <Table heads={["تاريخ التنفيذ", "العملية والنتيجة", "الحالة / الجهة", "المنفذ", "تاريخ ووقت التسجيل", "الوزن", "الحالة"]} empty="لا توجد عمليات بهذه الفلاتر.">
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="nowrap">{fmtDate(o.date)}</td>
              <td>{o.type} {o.auto && <Badge plain>تلقائية</Badge>}{o.result && <span className="cell-sub" style={{ color: "var(--text-2)" }}>{o.result}</span>}{o.notes && <span className="cell-sub">{o.notes}</span>}{o.attachment && <span className="cell-sub">{/^https?:\/\//.test(o.attachment) ? <a href={o.attachment} target="_blank" rel="noopener noreferrer" className="num">{o.attachment}</a> : <span className="num">{o.attachment}</span>}</span>}{o.attachments.map((a) => <span key={a.id} className="cell-sub"><a href={`/api/files/${a.id}`} target="_blank" rel="noopener noreferrer">مرفق: {a.name}</a></span>)}{o.returnNote && <span className="cell-sub" style={{ color: "var(--warn)" }}>أُرجعت: {o.returnNote}</span>}</td>
              <td>{o.caseCode ? <CaseLink code={o.caseCode} name={o.case?.name} /> : o.dept || "—"}</td>
              <td>{names.name(o.userId)}</td>
              <td className="nowrap">{fmtTs(o.createdAt)}</td>
              <td>{o.count > 1 ? `${o.count} × ` : ""}{Number(o.weight)}</td>
              <td>
                <Badge tone={o.status === "done" ? "ok" : o.status === "in_progress" ? "info" : ""}>{OP_STATUS_LABELS[o.status]}</Badge>
                {(o.userId === u.id || can(u.role, "return")) && !o.auto && o.status !== "done" && (
                  <ActionForm action={setOperationStatus} className="inline" feedbackTop={false}>
                    <input type="hidden" name="id" value={o.id} /><input name="result" placeholder="النتيجة" style={{ width: 130 }} />
                    <Submit className="btn secondary small" name="status" value="done" pendingText="…">تم</Submit>
                  </ActionForm>
                )}
                {can(u.role, "return") && o.status === "done" && (
                  <details><summary className="muted" style={{ cursor: "pointer" }}>إرجاع</summary>
                    <ActionForm action={returnOperation} className="inline" feedbackTop={false}><input type="hidden" name="id" value={o.id} /><input name="note" placeholder="السبب" required style={{ width: 140 }} /><Submit className="btn danger small" pendingText="…">إرجاع</Submit></ActionForm>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
