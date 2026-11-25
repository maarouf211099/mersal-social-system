import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { loadEnts } from "@/lib/entitlements";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { canFollow, followRequired } from "@/lib/stage";
import { fmtDate, fmtTs, money } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { followCall } from "@/actions/cycle";
import { Badge, CaseLink, PageHead, Seg, StageBadge, Table } from "@/components/ui";
import { addMonths, fmtMonth } from "@/lib/months";
import { AutoSubmitSelect, MonthSelect } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";

// الموقف في المتابعة (بنفس أسماء السيستم، و«لم يتم الصرف» = تم الرد ولم يتم الصرف)
const FOLLOW_STAGES: [string, string][] = [["sent", "تم الإرسال"], ["trans", "تم التحويل"], ["wait", "في انتظار المتابعة"], ["noans", "لم يتم الرد"], ["notpaid", "تم الرد ولم يتم الصرف"], ["recv", "تم الرد وتم الصرف"], ["deliv", "تم التسليم"], ["stuck", "متعثر"], ["refund", "مسترد"], ["stop", "موقوف"]];

const VIEWS = [{ key: "open", label: "مفتوحة" }, { key: "noans", label: "لم يتم الرد" }, { key: "done", label: "مكتملة" }, { key: "all", label: "الكل" }];

export default async function FollowPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), view = one(sp.view) || "open", q = one(sp.q).trim(), stage = one(sp.stage), method = one(sp.method);
  const st = await getSettings();
  const [ents, names] = await Promise.all([loadEnts({ OR: [
    { month: m, OR: [{ sentAt: { not: null } }, { legacySent: true }] },
    // مؤجل اتبعت في الشهر ده ولسه متابعته مفتوحة
    { month: { lt: m, gte: addMonths(m, -3) }, sentAt: { not: null }, followResult: "none", stoppedAt: null },
  ] }, st.followDays), userNames()]);
  const base = ents.filter((e) => followRequired(e.kind, e.line.service.needsFollow) && e.stage !== "missing"); // الناقص مكانه «استكمال البيانات»
  const stageCount = new Map<string, number>();
  base.forEach((e) => stageCount.set(e.stage, (stageCount.get(e.stage) ?? 0) + 1));
  const methods = [...new Set(base.map((e) => e.case.recvMethod).filter(Boolean))].sort();
  const list = base.filter((e) => {
    // فلتر الموقف بيدوّر في الكل (مثلاً «تم الرد ولم يتم الصرف» عشان معاودة الاتصال)
    if (stage) { if (e.stage !== stage) return false; }
    else {
      if (view === "open" && (e.followDone || e.stage === "stop" || e.stage === "refund")) return false;
      if (view === "done" && !e.followDone) return false;
      if (view === "noans" && e.stage !== "noans") return false;
    }
    if (method && (method === "_none" ? e.case.recvMethod : e.case.recvMethod !== method)) return false;
    return !q || e.caseCode.includes(q) || e.case.name.includes(q) || e.case.phone.includes(q);
  });
  return (
    <>
      <PageHead title="المتابعة" sub="أي خدمة بتنزل هنا أول ما تتبعت. اللي بيانات استلامها ناقصة مش بتظهر لحد ما تكمل. مسؤولية الموظف تكتمل بالرد أو بعد 3 محاولات موثقة.">
        <MonthSelect value={m} options={monthOpts(m)} />
      </PageHead>
      <div className="toolbar">
        <Seg current={stage ? "" : view} items={VIEWS.map((v) => ({ ...v, href: `/follow${qs({ m, view: v.key, method })}` }))} />
      </div>
      <form className="toolbar filters">
        <input type="hidden" name="m" value={m} /><input type="hidden" name="view" value={view} />
        <label className="field"><span>الموقف</span>
          <AutoSubmitSelect name="stage" defaultValue={stage}>
            <option value="">كل المواقف</option>
            {FOLLOW_STAGES.map(([k, l]) => <option key={k} value={k}>{l} ({stageCount.get(k) ?? 0})</option>)}
          </AutoSubmitSelect>
        </label>
        <label className="field"><span>طريقة الصرف</span>
          <AutoSubmitSelect name="method" defaultValue={method}><option value="">الكل</option>{methods.map((x) => <option key={x}>{x}</option>)}<option value="_none">غير مسجلة</option></AutoSubmitSelect>
        </label>
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف" /></label>
        <div className="auto inline"><button className="btn secondary">بحث</button>{(stage || method || q) && <Link className="btn ghost" href={`/follow${qs({ m, view })}`}>مسح</Link>}</div>
      </form>
      {stage === "notpaid" && <div className="alert warn"><span>دول اللي ردوا وقالوا لسه ما صرفوش. كلّمهم تاني: لو صرفوا اضغط «اتصرف بعد المعاودة» والحالة تتقفل للشهر.</span></div>}
      <div className="card">
        <Table wide heads={["الحالة", "الخدمة", "طريقة الصرف", "المحاولات", "الموقف", "تسجيل نتيجة الاتصال"]} empty="لا توجد متابعات في هذا العرض.">
          {list.map((e) => {
            const last = e.attempts[e.attempts.length - 1];
            const late = (e.stage === "noans" && e.followResult === "no_answer") || e.stage === "notpaid";
            return (
              <tr key={e.id}>
                <td><CaseLink code={e.caseCode} name={e.case.name} /><span className="cell-sub num">{e.case.phone}</span>{e.month !== m && <span className="cell-sub"><Badge tone="warn">مؤجل من {fmtMonth(e.month)}</Badge></span>}</td>
                <td>{e.serviceName}{e.line.beneficiary && <span className="cell-sub">المستفيد: {e.line.beneficiary}</span>}<span className="cell-sub">{money(e.transferred || e.amountN)} ج{e.transfer ? ` · ${fmtDate(e.transfer.date)}` : ""}</span></td>
                <td className="nowrap">{e.case.recvMethod || <span className="miss">غير مسجلة</span>}{e.case.recvPhone && <span className="cell-sub num">{e.case.recvPhone}</span>}{e.transfer && e.transfer.method !== e.case.recvMethod && <span className="cell-sub">اتحوّل: {e.transfer.method}</span>}</td>
                <td className="nowrap"><b style={{ color: e.followDone ? "var(--ok)" : "var(--bad)" }}>{e.attempts.length}/3</b>{last && <span className="cell-sub">{fmtTs(last.createdAt)} · {names.name(last.userId)}</span>}</td>
                <td><StageBadge stage={e.stage} kind={e.kind} />{e.notPaidReason && <span className="cell-sub">{e.notPaidReason}{e.notPaidAction ? ` · ${e.notPaidAction}` : ""}</span>}</td>
                <td>
                  {can(u.role, "follow") && ((canFollow(e.stage) && !e.followDone) || late) && (
                    <ActionForm action={followCall} className="inline">
                      <input type="hidden" name="entId" value={e.id} />
                      {!late && e.unanswered < 3 && <Submit className="btn secondary small" name="a" value="no_answer" pendingText="…">لم يرد</Submit>}
                      <Submit className="btn primary small" name="a" value="paid" pendingText="…">{e.stage === "notpaid" ? "اتصرف بعد المعاودة" : late ? "رد متأخر · تم الصرف" : "رد · تم الصرف"}</Submit>
                      {!late && <Link className="btn danger small" href={`/cycle/${e.id}`}>رد · لم يتم الصرف</Link>}
                    </ActionForm>
                  )}
                  {!((canFollow(e.stage) && !e.followDone) || late) && <Link className="btn secondary small" href={`/cycle/${e.id}`}>تفاصيل</Link>}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}
