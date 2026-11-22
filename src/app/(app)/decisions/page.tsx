import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { DEC_STATUS_LABELS, RENEWAL_LABELS } from "@/lib/constants";
import { addMonths, currentMonth, fmtMonth, toIdx } from "@/lib/months";
import { fmtDate, money } from "@/lib/format";
import { one, type SP } from "@/lib/page";
import { stopDecisions } from "@/actions/decisions";
import { Badge, CaseLink, PageHead, Table } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";
import { CasesTabs } from "@/components/CasesTabs";

export default async function DecisionsPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const q = one(sp.q).trim(), status = one(sp.status), svc = one(sp.svc), donation = one(sp.donation);
  const cm = currentMonth();
  const st = await getSettings();
  const where: Prisma.DecisionWhereInput = {
    ...(q ? { OR: [{ caseCode: { contains: q } }, { no: { contains: q } }, { case: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    ...(status === "ended" ? { OR: [{ status: "ended" }, { status: "active", lines: { every: { endMonth: { lt: cm } } } }] } : status === "active" ? { status: "active", lines: { some: { endMonth: { gte: cm } } } } : status ? { status: status as any } : {}),
    ...(svc ? { lines: { some: { serviceId: svc } } } : {}),
    ...(donation === "1" ? { needsDonation: true } : {}),
  };
  const [rows, services, names] = await Promise.all([
    prisma.decision.findMany({ where, take: 300, orderBy: { issueDate: "desc" }, include: { case: { select: { name: true } }, lines: { include: { service: true } } } }),
    prisma.service.findMany({ orderBy: { sort: "asc" } }),
    userNames(),
  ]);
  return (
    <>
      <PageHead title="الحالات والقرارات" sub="كل قرار له خدمة أو أكثر بمدة وقيمة. القرار المستمر الذي انتهت مدته يظهر «منتهي» تلقائياً.">
        {can(u.role, "decision") && <Link className="btn primary" href="/decisions/new"><Icon.plus /> تسجيل كود وقرار</Link>}
      </PageHead>
      <CasesTabs current="decisions" />
      <form className="toolbar">
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، رقم قرار" /></label>
        <label className="field"><span>حالة القرار</span><AutoSubmitSelect name="status" defaultValue={status}><option value="">الكل</option>{Object.entries(DEC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الخدمة</span><AutoSubmitSelect name="svc" defaultValue={svc}><option value="">الكل</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>التمويل</span><AutoSubmitSelect name="donation" defaultValue={donation}><option value="">الكل</option><option value="1">تحتاج لتبرع</option></AutoSubmitSelect></label>
        <button className="btn secondary auto">بحث</button>
      </form>
      <div className="card">
        <Table wide heads={["رقم", "الحالة", "تاريخ القرار", "الخدمة", "نص القرار", "البداية", "النهاية", "الحالة", ""]} empty="لا توجد قرارات.">
          {rows.map((d) => {
            const end = d.lines.reduce((m, l) => (l.endMonth > m ? l.endMonth : m), "");
            const start = d.lines.reduce((m, l) => (!m || l.startMonth < m ? l.startMonth : m), "");
            const eff = d.status === "active" && end < cm ? "ended" : d.status;
            const left = end ? toIdx(end) - toIdx(cm) + 1 : 0;
            return (
              <tr key={d.id}>
                <td className="nowrap"><Link className="strong" href={`/decisions/${d.id}`}>{d.no}</Link><span className="cell-sub">{d.renewOfId ? "مجدد" : "جديد"}</span></td>
                <td><CaseLink code={d.caseCode} name={d.case.name} /></td>
                <td className="nowrap">{fmtDate(d.issueDate)}<span className="cell-sub">{names.name(d.createdById)}</span></td>
                <td>{d.lines.map((l) => <span key={l.id} className="line-item">{l.service.name}{l.beneficiary ? ` (${l.beneficiary})` : ""} · {money(l.amount)} ج{d.lines.length > 1 && <small> · {fmtMonth(l.startMonth)} ← {fmtMonth(l.endMonth)}</small>}</span>)}</td>
                <td className="clip" title={d.text || undefined}><div className="clamp">{d.text || "—"}</div></td>
                <td className="nowrap date-cell">{fmtMonth(start)}</td>
                <td className="nowrap date-cell">{fmtMonth(end)}{eff === "active" && left > 0 && end <= addMonths(cm, st.renewLead) && <span className="cell-sub"><Badge tone="warn">متبقي {left} شهر</Badge></span>}</td>
                <td><Badge tone={eff === "active" ? "ok" : eff === "ended" ? "" : "bad"}>{DEC_STATUS_LABELS[eff]}</Badge>{d.stopReason && <span className="cell-sub">{d.stopReason}</span>}{d.renewalStatus !== "none" && <span className="cell-sub">{RENEWAL_LABELS[d.renewalStatus]}</span>}{d.needsDonation && <span className="cell-sub"><Badge tone="warn">تحتاج لتبرع</Badge></span>}</td>
                <td className="nowrap">
                  {can(u.role, "decision") && <Link className="btn secondary small" href={`/decisions/new?renew=${d.id}`}>تجديد</Link>}{" "}
                  {d.status === "active" && can(u.role, "decision.stop") && (
                    <details style={{ display: "inline-block" }}><summary className="btn danger small">إيقاف / سحب</summary>
                      <div className="card" style={{ position: "absolute", zIndex: 5, width: 300 }}>
                        <ActionForm action={stopDecisions}>
                          <input type="hidden" name="ids" value={d.id} />
                          <label className="field"><span>الإجراء</span><select name="status" defaultValue="stopped"><option value="stopped">إيقاف</option><option value="withdrawn">سحب</option><option value="ended">إغلاق كمنتهي</option></select></label>
                          <label className="field"><span>السبب *</span><input name="reason" required /></label>
                          <p className="muted">الاستحقاقات غير المرسلة من هذا الشهر وما بعده تتوقف. السجل التاريخي لا يُحذف.</p>
                          <Submit className="btn danger">تأكيد</Submit>
                        </ActionForm>
                      </div>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}
