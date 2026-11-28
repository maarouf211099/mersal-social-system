import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { closedLines, closingCandidates } from "@/lib/closing";
import { currentMonth, fmtMonth } from "@/lib/months";
import { fmtTs } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { closeLines } from "@/actions/decisions";
import { Badge, CaseLink, PageHead, Table } from "@/components/ui";
import { MonthSelect, SelectAll } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";

/** قائمة الغلق: خدمات ما اتوصلناش فيها للحالة شهرين ورا بعض → غلق بسبب + شيت للإيميل */
export default async function ClosingPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const view = one(sp.view) || "candidates";
  const m = monthOf(sp);
  const [rows, closed, names] = await Promise.all([
    view === "candidates" ? closingCandidates() : Promise.resolve([]),
    view === "closed" ? closedLines(m) : Promise.resolve([]),
    userNames(),
  ]);
  return (
    <>
      <PageHead title="قائمة الغلق" sub="الخدمات اللي ما اتوصلناش فيها للحالة شهرين ورا بعض (اتأجلت وما اتبعتش، أو 3 محاولات اتصال بدون رد). اقفل الخدمة بسبب، ونزّل الشيت وابعته في الإيميل للإثبات.">
        {view === "closed" && <MonthSelect value={m} options={monthOpts(m)} />}
      </PageHead>
      <div className="tabs" role="tablist">
        <Link role="tab" href="/closing" aria-current={view === "candidates" ? "page" : undefined}>مرشحة للغلق</Link>
        <Link role="tab" href={`/closing${qs({ view: "closed", m: currentMonth() })}`} aria-current={view === "closed" ? "page" : undefined}>اتقفلت</Link>
      </div>
      {view === "candidates" ? (
        <ActionForm action={closeLines} resetOnOk>
          <div className="card">
            <div className="toolbar">
              <span className="muted"><b>{rows.length}</b> خدمة مرشحة للغلق</span>
              <span className="spacer" />
              {rows.length > 0 && <a className="btn secondary" href="/api/export/closing?format=xlsx"><Icon.download /> تصدير Excel</a>}
            </div>
            {can(u, "decision.stop") && rows.length > 0 && (
              <div className="toolbar">
                <label className="field grow"><span>سبب الغلق *</span><input name="reason" defaultValue="عدم الوصول للحالة شهرين متتاليين (3 محاولات اتصال بدون رد)" /></label>
                <div className="auto"><Submit className="btn danger">غلق الخدمة للمحدد</Submit></div>
              </div>
            )}
            <Table wide heads={[<SelectAll key="a" name="ids" />, "الحالة", "الخدمة", "القرار", "الشهور", "محاولات الاتصال"]} empty="مفيش خدمات مرشحة للغلق دلوقتي.">
              {rows.map((r) => (
                <tr key={r.lineId}>
                  <td><input type="checkbox" name="ids" value={r.lineId} aria-label="تحديد" /></td>
                  <td className="nowrap"><CaseLink code={r.caseCode} name={r.name} /><span className="cell-sub num">{r.phone}</span></td>
                  <td className="nowrap">{r.service}{r.beneficiary && <span className="cell-sub">المستفيد: {r.beneficiary}</span>}</td>
                  <td className="clip"><Link href={`/decisions/${r.decisionId}`}>{r.decisionNo}</Link>{r.decisionText && <div className="clamp muted">{r.decisionText}</div>}</td>
                  <td>{r.months.map((x) => <div key={x.month}><b>{fmtMonth(x.month)}</b> <span className="muted">· {x.why}</span></div>)}</td>
                  <td className="info-cell">{r.attempts.length ? r.attempts.slice(-6).map((a, i) => <div key={i}><span className="num">{fmtTs(a.at)}</span> · {a.kind} · {a.result} <span className="muted">· {a.by}</span></div>) : <span className="muted">ما اتسجلش اتصال</span>}</td>
                </tr>
              ))}
            </Table>
          </div>
        </ActionForm>
      ) : (
        <div className="card">
          <div className="toolbar">
            <span className="muted"><b>{closed.length}</b> خدمة اتقفلت في {fmtMonth(m)}</span>
            <span className="spacer" />
            {closed.length > 0 && <a className="btn secondary" href={`/api/export/closing${qs({ view: "closed", m, format: "xlsx" })}`}><Icon.download /> تصدير Excel للإيميل</a>}
          </div>
          <Table heads={["الحالة", "الخدمة", "القرار", "السبب", "قفلها", "الوقت"]} empty="مفيش خدمات اتقفلت في الشهر ده.">
            {closed.map((l) => (
              <tr key={l.id}>
                <td className="nowrap"><CaseLink code={l.caseCode} name={l.decision.case.name} /></td>
                <td>{l.service.name}{l.beneficiary && <span className="cell-sub">المستفيد: {l.beneficiary}</span>}</td>
                <td><Link href={`/decisions/${l.decisionId}`}>{l.decision.no}</Link>{l.decision.status === "stopped" && <span className="cell-sub"><Badge tone="bad">القرار اتوقف</Badge></span>}</td>
                <td>{l.stopReason}</td>
                <td>{names.name(l.stoppedById)}</td>
                <td className="nowrap">{fmtTs(l.stoppedAt)}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </>
  );
}
