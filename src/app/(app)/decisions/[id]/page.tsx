import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { DEC_STATUS_LABELS } from "@/lib/constants";
import { addMonths, fmtMonth, monthOptions } from "@/lib/months";
import { fmtDate, fmtTs, isoDate, money } from "@/lib/format";
import { correctDecision, correctLine, setNeedsDonation } from "@/actions/corrections";
import { Badge, CaseLink, PageHead, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePageUser();
  const { id } = await params;
  const d = await prisma.decision.findUnique({ where: { id }, include: { case: true, lines: { include: { service: true, entitlements: { select: { month: true, sentAt: true, legacySent: true } } } } } });
  if (!d) notFound();
  const [names, history] = await Promise.all([
    userNames(),
    prisma.auditLog.findMany({ where: { target: d.caseCode, action: { in: ["decision_corrected", "line_corrected", "decision_status", "decision_created", "decision_renewed"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const edit = can(u.role, "approve") && d.status === "active";
  return (
    <>
      <PageHead title={`قرار ${d.no}`} sub={<><CaseLink code={d.caseCode} name={d.case.name} /> · <Badge tone={d.status === "active" ? "ok" : "bad"}>{DEC_STATUS_LABELS[d.status]}</Badge></>}>
        {can(u.role, "decision") && <Link className="btn secondary" href={`/decisions/new?renew=${d.id}`}>تجديد</Link>}
      </PageHead>
      <div className="card">
        <div className="kv">
          <div><span>تاريخ القرار</span>{fmtDate(d.issueDate)}</div><div><span>المتبرع</span>{d.donor || "—"}</div>
          <div><span>سجّله</span>{names.name(d.createdById)} · {fmtTs(d.createdAt)}</div>{d.overrideNote && <div><span>اعتماد تعارض</span>{d.overrideNote}</div>}
          {d.stopReason && <div><span>سبب الإيقاف</span>{d.stopReason}</div>}{d.sourceStatus && <div><span>الموقف في شيت القرارات</span>{d.sourceStatus}</div>}{d.needsDonation && <div><span>التمويل</span><Badge tone="warn">تحتاج لتبرع</Badge></div>}
        </div>
        {d.text && <p className="muted" style={{ marginTop: 10 }}>{d.text}</p>}
      </div>
      <div className="section-title"><h2>الخدمات</h2>{edit && <span className="muted">التصحيح يسري على الشهور اللي لسه ما اتبعتتش فقط.</span>}</div>
      <div className="card">
        <Table heads={["الخدمة", "القيمة", "المدة", "اتصرف لحد", edit ? "تصحيح (مشرف)" : ""]}>
          {d.lines.map((l) => {
            const sent = l.entitlements.filter((e) => e.sentAt || e.legacySent).map((e) => e.month).sort().at(-1);
            return (
              <tr key={l.id}>
                <td>{l.service.name}{l.beneficiary && <span className="cell-sub">المستفيد: {l.beneficiary}</span>}{l.category && <span className="cell-sub">{l.category}</span>}{l.note && <span className="cell-sub">{l.note}</span>}</td><td>{money(l.amount)}</td>
                <td className="nowrap">{fmtMonth(l.startMonth)} ← {fmtMonth(l.endMonth)}<span className="cell-sub">{l.months} شهر{l.extendedBy ? ` · مُدد ${l.extendedBy}` : ""}{l.mismatchNote ? ` · ${l.mismatchNote}` : ""}</span></td>
                <td>{sent ? fmtMonth(sent) : "—"}</td>
                <td>{edit && (
                  <ActionForm action={correctLine} className="inline" feedbackTop={false}>
                    <input type="hidden" name="lineId" value={l.id} />
                    <input type="number" name="amount" defaultValue={Number(l.amount)} min={0} style={{ width: 100 }} aria-label="القيمة" />
                    <select name="endMonth" defaultValue={l.endMonth} style={{ width: 140 }} aria-label="النهاية">{monthOptions(addMonths(l.startMonth, 18), 18 + 6, 0).reverse().filter((m) => m >= l.startMonth).map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select>
                    <input name="reason" placeholder="سبب التصحيح *" required style={{ width: 160 }} />
                    <Submit className="btn secondary small" pendingText="…">تصحيح</Submit>
                  </ActionForm>
                )}</td>
              </tr>
            );
          })}
        </Table>
      </div>
      {edit && (
        <details className="box" style={{ marginTop: 14 }}><summary>{d.needsDonation ? "شيل علامة «تحتاج لتبرع» (اتلاقى متبرع)" : "علّم القرار «تحتاج لتبرع»"}</summary>
          <ActionForm action={setNeedsDonation} className="row">
            <input type="hidden" name="id" value={d.id} /><input type="hidden" name="on" value={d.needsDonation ? "0" : "1"} />
            {d.needsDonation && <label className="field"><span>اسم المتبرع (اختياري)</span><input name="note" /></label>}
            <div className="auto"><Submit className="btn secondary">حفظ</Submit></div>
          </ActionForm>
        </details>
      )}
      {edit && (
        <details className="box" style={{ marginTop: 14 }}><summary>تصحيح بيانات القرار (الرقم، التاريخ، المتبرع، النص)</summary>
          <ActionForm action={correctDecision}>
            <input type="hidden" name="id" value={d.id} />
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field"><span>رقم القرار</span><input name="no" defaultValue={d.no} /></label>
              <label className="field"><span>تاريخ القرار</span><input type="date" name="issueDate" defaultValue={isoDate(d.issueDate)} /></label>
              <label className="field"><span>المتبرع</span><input name="donor" defaultValue={d.donor} /></label>
            </div>
            <label className="field"><span>نص القرار</span><textarea name="text" defaultValue={d.text} /></label>
            <label className="field"><span>سبب التصحيح *</span><input name="reason" required /></label>
            <div><Submit>حفظ التصحيح</Submit></div>
          </ActionForm>
        </details>
      )}
      <div className="section-title"><h2>سجل القرار</h2></div>
      <div className="card">
        <Table heads={["الوقت", "المستخدم", "الإجراء", "التفاصيل"]} empty="لا يوجد.">
          {history.map((h) => <tr key={String(h.id)}><td className="nowrap">{fmtTs(h.createdAt)}</td><td>{names.name(h.userId)}</td><td>{h.action}</td><td className="cell-sub" style={{ wordBreak: "break-word", maxWidth: 520 }}>{JSON.stringify(h.meta)}</td></tr>)}
        </Table>
      </div>
    </>
  );
}
