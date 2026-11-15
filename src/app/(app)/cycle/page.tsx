import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { loadEnts } from "@/lib/entitlements";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { STAGES, canSend, type Stage } from "@/lib/stage";
import { RECV_METHODS } from "@/lib/constants";
import { fmtMonth } from "@/lib/months";
import { fmtTs, money } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { cycleBulk, generateMonth } from "@/actions/cycle";
import { CaseLink, PageHead, Seg, StageBadge, Table } from "@/components/ui";
import { MonthSelect, SelectAll } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Steps } from "@/components/Steps";

const KINDS = [{ key: "financial", label: "مالي" }, { key: "card", label: "كارت" }, { key: "in_kind", label: "عيني" }, { key: "service", label: "خدمات (سكن، علاج، متابعة)" }];

export default async function CyclePage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), kind = one(sp.kind) || "financial", stage = one(sp.stage) as Stage | "", q = one(sp.q).trim();
  const st = await getSettings();
  const all = await loadEnts({ month: m, line: { service: { kind: kind as any } } }, st.followDays);
  const names = await userNames();
  const counts: Partial<Record<Stage, number>> = {};
  all.forEach((e) => (counts[e.stage] = (counts[e.stage] ?? 0) + 1));
  const list = all.filter((e) => (!stage || e.stage === stage) && (!q || e.caseCode.includes(q) || e.case.name.includes(q)));
  const sendable = list.filter((e) => canSend(e.stage)).length;
  const transferable = list.filter((e) => e.kind === "financial" && e.sentAt && !e.transfer && !e.stoppedAt).length;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHead title="دورة الصرف" sub="توليد الاستحقاقات ← تأكيد بيانات الحالات الجديدة ← الإرسال في دفعة ← التحويل ← المتابعة">
        <MonthSelect value={m} options={monthOpts(m)} />
        {can(u.role, "generate") && (
          <ActionForm action={generateMonth} className="inline"><input type="hidden" name="m" value={m} /><Submit className="btn secondary">توليد استحقاقات {fmtMonth(m)}</Submit></ActionForm>
        )}
      </PageHead>
      <div className="toolbar">
        <Seg current={kind} items={KINDS.map((k) => ({ key: k.key, label: k.label, href: `/cycle${qs({ m, kind: k.key })}` }))} />
        <div className="seg">
          <Link href={`/cycle${qs({ m, kind })}`} aria-current={!stage ? "page" : undefined}>الكل {all.length}</Link>
          {(Object.keys(STAGES) as Stage[]).filter((s) => counts[s]).map((s) => <Link key={s} href={`/cycle${qs({ m, kind, stage: s })}`} aria-current={stage === s ? "page" : undefined}>{STAGES[s].label} {counts[s]}</Link>)}
        </div>
        <form className="inline"><input type="hidden" name="m" value={m} /><input type="hidden" name="kind" value={kind} />{stage && <input type="hidden" name="stage" value={stage} />}<input type="search" name="q" defaultValue={q} placeholder="كود أو اسم" style={{ width: 180 }} /></form>
      </div>
      <ActionForm action={cycleBulk} resetOnOk>
        <input type="hidden" name="m" value={m} />
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 6 }}>
            <span className="muted">{fmtMonth(m)} · {list.length} استحقاق · الإجمالي {money(list.reduce((s, e) => s + e.amountN, 0))} جنيه</span>
            <span className="spacer" />
            {can(u.role, "send") && <Submit className="btn primary" name="op" value="send" disabled={!sendable}>{kind === "in_kind" ? "تم التسليم للمحدد" : kind === "card" ? "تم إرسال الكارت للمحدد" : kind === "service" ? "تم التنفيذ للمحدد" : "إرسال المحدد ضمن دفعة"}</Submit>}
          </div>
          {kind === "financial" && can(u.role, "transfer") && transferable > 0 && (
            <details className="box" style={{ marginBottom: 12 }}>
              <summary>تسجيل التحويل للمحدد ({transferable} حالة مُرسلة تنتظر التحويل)</summary>
              <div className="row" style={{ marginTop: 10 }}>
                <label className="field"><span>طريقة التحويل *</span><select name="method" defaultValue=""><option value="">اختار</option>{RECV_METHODS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="field"><span>تاريخ التحويل *</span><input type="date" name="date" defaultValue={today} /></label>
                <label className="field"><span>مرجع الدفعة / إذن الصرف *</span><input name="ref" dir="ltr" /></label>
                <div className="auto"><Submit className="btn primary" name="op" value="transfer">حفظ التحويل</Submit></div>
              </div>
              <p className="muted" style={{ marginTop: 8 }}>كل حالة تُسجَّل بقيمة استحقاقها. التحويل لا يعني الاستلام.</p>
            </details>
          )}
          <Table heads={[<SelectAll key="a" name="ids" />, "الحالة", "الخدمة", "القيمة", "الموقف والخطوات", "الإرسال", "التحويل"]}
            empty={all.length ? "لا استحقاقات بهذه الفلاتر." : `لم تُولَّد استحقاقات ${fmtMonth(m)} لهذا النوع بعد. اضغط «توليد استحقاقات ${fmtMonth(m)}».`}>
            {list.slice(0, 800).map((e) => (
              <tr key={e.id}>
                <td><input type="checkbox" name="ids" value={e.id} aria-label="تحديد" /></td>
                <td><CaseLink code={e.caseCode} name={e.case.name} /></td>
                <td>{e.serviceName}{e.line.beneficiary && <span className="cell-sub">المستفيد: {e.line.beneficiary}</span>}{e.resendCount > 0 && <span className="cell-sub">أُعيد الإرسال ×{e.resendCount}</span>}</td>
                <td className="nowrap">{money(e.amountN)}{Number(e.carriedAmount) > 0 && <span className="cell-sub">+{money(e.carriedAmount)} مرحّل</span>}</td>
                <td><Link href={`/cycle/${e.id}`}><StageBadge stage={e.stage} kind={e.kind} /></Link><Steps e={e} /></td>
                <td className="nowrap">{e.sentAt ? <>{fmtTs(e.sentAt)}<span className="cell-sub">{names.name(e.sentById)}</span></> : "—"}</td>
                <td>{e.transfer ? <>{e.transfer.method}<span className="cell-sub num">{e.transfer.ref}</span></> : "—"}</td>
              </tr>
            ))}
          </Table>
        </div>
      </ActionForm>
    </>
  );
}
