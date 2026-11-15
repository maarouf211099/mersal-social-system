import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { RENEWAL_LABELS } from "@/lib/constants";
import { addMonths, currentMonth, fmtMonth, toIdx } from "@/lib/months";
import { fmtTs, money } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { markNotRenewed, sendForRenewal, stopDecisions } from "@/actions/decisions";
import { Badge, CaseLink, PageHead, Seg, Table } from "@/components/ui";
import { MonthSelect, SelectAll } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";

export default async function RenewalPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), view = one(sp.view) || "soon";
  const st = await getSettings();
  const cm = currentMonth();
  const [decs, names] = await Promise.all([
    prisma.decision.findMany({ where: { status: "active" }, include: { case: true, lines: { include: { service: true } } } }),
    userNames(),
  ]);
  const withEnd = decs.map((d) => ({ ...d, end: d.lines.reduce((x, l) => (l.endMonth > x ? l.endMonth : x), "") })).filter((d) => d.end);
  const lists = {
    soon: withEnd.filter((d) => d.end >= m && d.end <= addMonths(m, st.renewLead) && d.end >= cm),
    sent: withEnd.filter((d) => d.renewalStatus === "sent"),
    ended: withEnd.filter((d) => d.end < cm),
  };
  const list = (lists[view as keyof typeof lists] ?? lists.soon).sort((a, b) => a.end.localeCompare(b.end));
  const hint = {
    soon: `قرارات مستمرة آخر شهر فيها خلال ${st.renewLead} شهر من ${fmtMonth(m)}. أرسلها للتجديد أو إعادة البحث قبل انتهائها.`,
    sent: "قرارات أُرسلت للتجديد ولم يُسجل لها قرار جديد بعد.",
    ended: `قرارات حالتها «مستمر» وانتهت كل خدماتها قبل ${fmtMonth(cm)}. لا يُنشأ لها أي استحقاق، وتحتاج إغلاقاً رسمياً.`,
  }[view as "soon"] ?? "";
  return (
    <>
      <PageHead title="التجديد والانتهاء" sub={hint}><MonthSelect value={m} options={monthOpts(m)} /></PageHead>
      <div className="toolbar">
        <Seg current={view} items={[
          { key: "soon", label: `تنتهي خلال ${st.renewLead} شهر (${lists.soon.length})`, href: `/renewal${qs({ m, view: "soon" })}` },
          { key: "sent", label: `أُرسلت للتجديد (${lists.sent.length})`, href: `/renewal${qs({ m, view: "sent" })}` },
          { key: "ended", label: `انتهت وتنتظر الإغلاق (${lists.ended.length})`, href: `/renewal${qs({ m, view: "ended" })}` },
        ]} />
        <Link className="btn secondary" href={`/api/export/renewal${qs({ m, view })}`}><Icon.download /> تصدير القائمة (CSV)</Link>
      </div>
      <ActionForm action={view === "ended" ? stopDecisions : sendForRenewal} resetOnOk>
        <div className="card">
          {view !== "sent" && (
            <div className="toolbar">
              {view === "ended" ? (
                <><input type="hidden" name="status" value="ended" /><input type="hidden" name="reason" value="انتهاء المدة" />
                  {can(u.role, "close") && <Submit className="btn primary">إغلاق المحدد كمنتهي</Submit>}</>
              ) : (
                <><label className="field grow"><span>ملاحظة الإرسال (مثال: أُرسلت لإدارة البحث)</span><input name="note" /></label>
                  {can(u.role, "renewal") && <div className="auto"><Submit className="btn primary">إرسال المحدد للتجديد</Submit></div>}</>
              )}
            </div>
          )}
          <Table heads={[<SelectAll key="a" name="ids" />, "رقم", "الحالة", "التواصل", "الخدمات", "آخر شهر", "موقف التجديد", ""]} empty="لا توجد قرارات في هذه القائمة.">
            {list.map((d) => {
              const left = toIdx(d.end) - toIdx(m) + 1;
              return (
                <tr key={d.id}>
                  <td><input type="checkbox" name="ids" value={d.id} aria-label="تحديد" /></td>
                  <td>{d.no}</td>
                  <td><CaseLink code={d.caseCode} name={d.case.name} /></td>
                  <td><span className="num">{d.case.phone || "—"}</span><span className="cell-sub">{d.case.governorate}</span></td>
                  <td>{d.lines.map((l) => <span key={l.id} className="cell-sub" style={{ color: "var(--text-2)" }}>{l.service.name} · {money(l.amount)} ج · حتى {fmtMonth(l.endMonth)}</span>)}</td>
                  <td className="nowrap">{fmtMonth(d.end)}{view !== "ended" && <span className="cell-sub"><Badge tone={left <= 1 ? "bad" : "warn"}>متبقي {left} شهر</Badge></span>}</td>
                  <td>{d.renewalStatus !== "none" ? <><Badge tone="info">{RENEWAL_LABELS[d.renewalStatus]}</Badge><span className="cell-sub">{fmtTs(d.renewalAt)} · {names.name(d.renewalById)}</span></> : <span className="muted">لم يُرسل</span>}</td>
                  <td className="nowrap">{view !== "ended" && can(u.role, "decision") && <Link className="btn secondary small" href={`/decisions/new?renew=${d.id}`}>تسجيل قرار التجديد</Link>}</td>
                </tr>
              );
            })}
          </Table>
        </div>
      </ActionForm>
      {view === "sent" && can(u.role, "renewal") && list.length > 0 && (
        <details className="box" style={{ marginTop: 14 }}><summary>تسجيل «لم يُجدد» لقرار</summary>
          <ActionForm action={markNotRenewed} className="inline">
            <select name="id" style={{ width: 280 }}>{list.map((d) => <option key={d.id} value={d.id}>{d.no} · {d.caseCode} · {d.case.name}</option>)}</select>
            <Submit className="btn secondary">حفظ</Submit>
          </ActionForm>
        </details>
      )}
    </>
  );
}
