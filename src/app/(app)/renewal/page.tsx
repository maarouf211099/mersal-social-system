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
import { endingBulk, markNotRenewed, sendForRenewal, stopDecisions } from "@/actions/decisions";
import { Badge, CaseLink, PageHead, Seg, Table } from "@/components/ui";
import { MonthSelect, SelectAll } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";
import { noReplyDecisionIds } from "@/lib/noreply";

export default async function RenewalPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), view = one(sp.view) || "soon";
  const st = await getSettings();
  const cm = currentMonth();
  // نحسب القوائم من آخر شهر لكل قرار (استعلام مجمّع)، ونحمّل التفاصيل للقائمة المفتوحة بس
  const [ends, sentIds, names, noReplyIds] = await Promise.all([
    prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decision: { status: "active" } }, _max: { endMonth: true } }),
    prisma.decision.findMany({ where: { status: "active", renewalStatus: "sent" }, select: { id: true } }),
    userNames(),
    noReplyDecisionIds(), // عدم الرد لشهرين متتاليين: آخر نتيجتين متابعة لنفس الخدمة «لم يتم الرد»
  ]);
  const endOf = new Map(ends.map((g) => [g.decisionId, g._max.endMonth ?? ""]));
  const ids = {
    ending: ends.filter((g) => (g._max.endMonth ?? "") === m).map((g) => g.decisionId),
    soon: ends.filter((g) => { const e = g._max.endMonth ?? ""; return e >= m && e >= cm && e <= addMonths(m, st.renewLead); }).map((g) => g.decisionId),
    sent: sentIds.map((d) => d.id).filter((id) => endOf.has(id)),
    ended: ends.filter((g) => (g._max.endMonth ?? "") < cm).map((g) => g.decisionId),
    noreply: [...noReplyIds].filter((id) => endOf.has(id)),
  };
  const lists = ids;
  const viewIds = (ids[view as keyof typeof ids] ?? ids.soon).slice(0, 1500);
  const list = (await prisma.decision.findMany({ where: { id: { in: viewIds } }, include: { case: true, lines: { include: { service: true } } } }))
    .map((d) => ({ ...d, end: endOf.get(d.id) ?? "" })).sort((a, b) => a.end.localeCompare(b.end));
  const hint = {
    ending: `قرارات مستمرة آخر شهر فيها ${fmtMonth(m)}. راجعها قبل قفل الشهر: أرسلها للتجديد، أو أغلقها كمنتهية (شهرها الأخير بيتصرف عادي)، أو أوقفها بسبب.`,
    soon: `قرارات مستمرة آخر شهر فيها خلال ${st.renewLead} شهر من ${fmtMonth(m)}. أرسلها للتجديد أو إعادة البحث قبل انتهائها.`,
    sent: "قرارات أُرسلت للتجديد ولم يُسجل لها قرار جديد بعد.",
    ended: `قرارات حالتها «مستمر» وانتهت كل خدماتها قبل ${fmtMonth(cm)}. لا يُنشأ لها أي استحقاق، وتحتاج إغلاقاً رسمياً.`,
    noreply: "قرارات مستمرة آخر شهرين متابعة فيهم انتهوا بـ«لم يتم الرد» (3 محاولات كل شهر). راجعها وأوقفها أو حوّلها لإعادة البحث.",
  }[view as "soon"] ?? "";
  return (
    <>
      <PageHead title="التجديد والانتهاء" sub={hint}><MonthSelect value={m} options={monthOpts(m)} /></PageHead>
      <div className="toolbar">
        <Seg current={view} items={[
          { key: "ending", label: `تنتهي في ${fmtMonth(m)} (${lists.ending.length})`, href: `/renewal${qs({ m, view: "ending" })}` },
          { key: "soon", label: `تنتهي خلال ${st.renewLead} شهر (${lists.soon.length})`, href: `/renewal${qs({ m, view: "soon" })}` },
          { key: "sent", label: `أُرسلت للتجديد (${lists.sent.length})`, href: `/renewal${qs({ m, view: "sent" })}` },
          { key: "ended", label: `انتهت وتنتظر الإغلاق (${lists.ended.length})`, href: `/renewal${qs({ m, view: "ended" })}` },
          { key: "noreply", label: `عدم رد لشهرين متتاليين (${lists.noreply.length})`, href: `/renewal${qs({ m, view: "noreply" })}` },
        ]} />
        <a className="btn secondary" href={`/api/export/renewal${qs({ m, view, format: "xlsx" })}`}><Icon.download /> تصدير Excel</a>
      </div>
      {view === "ending" && (
        <div className="chips">
          <Link href={`/renewal${qs({ m: cm, view: "ending" })}`} aria-current={m === cm ? "page" : undefined}>تنتهي هذا الشهر ({fmtMonth(cm)})</Link>
          <Link href={`/renewal${qs({ m: addMonths(cm, 1), view: "ending" })}`} aria-current={m === addMonths(cm, 1) ? "page" : undefined}>تنتهي الشهر القادم ({fmtMonth(addMonths(cm, 1))})</Link>
        </div>
      )}
      <ActionForm action={view === "ending" ? endingBulk : view === "ended" || view === "noreply" ? stopDecisions : sendForRenewal} resetOnOk>
        <div className="card">
          {view === "ending" && (
            <div className="toolbar">
              <label className="field grow"><span>ملاحظة / سبب (مطلوب للإيقاف)</span><input name="reason" placeholder="مثال: أُرسلت لإدارة البحث · أو سبب الإيقاف" /></label>
              <div className="auto inline">
                {can(u.role, "renewal") && <Submit className="btn primary" name="op" value="renew">إرسال المحدد للتجديد</Submit>}
                {can(u.role, "close") && <Submit className="btn secondary" name="op" value="close">إغلاق المحدد كمنتهي</Submit>}
                {can(u.role, "decision.stop") && <Submit className="btn danger" name="op" value="stop">إيقاف المحدد</Submit>}
              </div>
            </div>
          )}
          {view !== "sent" && view !== "ending" && (
            <div className="toolbar">
              {view === "noreply" ? (
                <><input type="hidden" name="status" value="stopped" /><input type="hidden" name="reason" value="عدم الرد لشهرين متتاليين" />
                  {can(u.role, "decision.stop") && <Submit className="btn danger">إيقاف المحدد (عدم الرد لشهرين)</Submit>}
                  {can(u.role, "renewal") && <span className="muted">أو أرسلها للتجديد / إعادة البحث من قائمة «تنتهي خلال».</span>}</>
              ) : view === "ended" ? (
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
                  <td>{d.lines.map((l) => <span key={l.id} className="line-item">{l.service.name}{l.beneficiary ? ` (${l.beneficiary})` : ""} · {money(l.amount)} ج <small>· {fmtMonth(l.startMonth)} ← {fmtMonth(l.endMonth)}</small></span>)}{d.text && <span className="cell-sub clamp" title={d.text}>{d.text}</span>}</td>
                  <td className="nowrap">{fmtMonth(d.end)}{view !== "ended" && view !== "noreply" && <span className="cell-sub"><Badge tone={left <= 1 ? "bad" : "warn"}>متبقي {left} شهر</Badge></span>}</td>
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
