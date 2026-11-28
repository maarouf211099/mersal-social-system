import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { userNames } from "@/lib/users";
import { dataList } from "@/lib/data-list";
import { fmtMonth } from "@/lib/months";
import { fmtTs } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { CaseLink, PageHead, Table } from "@/components/ui";
import { MonthSelect } from "@/components/client";
import { Icon } from "@/components/icons";

const VIEWS = [{ key: "missing", label: "محتاجة استكمال" }, { key: "noans", label: "3 محاولات بدون رد" }, { key: "all", label: "الكل" }];

/** فريق البيانات: يكلّم الحالات ويكمّل بيانات الاستلام كل شهر — لحد ما تكمل مش بتتبعت ولا بتنزل المتابعة */
export default async function DataPage({ searchParams }: { searchParams: SP }) {
  await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), view = one(sp.view) || "missing", q = one(sp.q).trim();
  const [all, names] = await Promise.all([dataList(m), userNames()]);
  const count = (k: string) => all.filter((r) => (k === "all" ? true : k === "noans" ? r.tries >= 3 : r.stage === k && r.tries < 3)).length;
  const rows = all.filter((r) => (view === "all" || (view === "noans" ? r.tries >= 3 : r.stage === view && r.tries < 3)) && (!q || r.code.includes(q) || r.name.includes(q) || r.phone.includes(q)));
  return (
    <>
      <PageHead title="استكمال البيانات" sub="الحالات اللي عندها صرف الشهر ده (أو مؤجل) وبيانات الاستلام ناقصة: الهاتف، اسم المستلم، الرقم القومي، موقف الإقامة وتاريخ انتهائها. مش بتتبعت ولا بتنزل المتابعة لحد ما تكمل.">
        <MonthSelect value={m} options={monthOpts(m)} />
      </PageHead>
      <div className="tabs" role="tablist">
        {VIEWS.map((v) => <Link key={v.key} role="tab" href={`/data${qs({ m, view: v.key })}`} aria-current={view === v.key ? "page" : undefined}>{v.label}<span className="tab-count">{count(v.key)}</span></Link>)}
      </div>
      <form className="toolbar">
        <input type="hidden" name="m" value={m} /><input type="hidden" name="view" value={view} />
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف" /></label>
        <button className="btn secondary auto">بحث</button>
        <span className="spacer" />
        <a className="btn secondary auto" href={`/api/export/data${qs({ m, view, format: "xlsx" })}`}><Icon.download /> تصدير Excel</a>
      </form>
      <div className="card">
        <Table wide heads={["الحالة", "رقم الهاتف", "الناقص", "الخدمات المستنية", "محاولات الاتصال", "المسؤول", ""]} empty="مفيش حالات في القائمة دي.">
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="nowrap"><CaseLink code={r.code} name={r.name} /></td>
              <td>{r.phone ? <span className="num">{r.phone}</span> : <span className="miss">ناقص</span>}</td>
              <td>{r.missing.map((x) => <span key={x} className="miss" style={{ margin: "0 0 3px 4px" }}>{x}</span>)}</td>
              <td>{r.ents.map((e) => <span key={e.id} className="line-item">{e.serviceName}{e.month !== m && <small> · مؤجل من {fmtMonth(e.month)}</small>}</span>)}</td>
              <td className="nowrap"><b style={{ color: r.tries >= 3 ? "var(--bad)" : undefined }}>{r.tries}/3</b> بدون رد{r.lastTry && <span className="cell-sub">آخر محاولة {fmtTs(r.lastTry)}</span>}</td>
              <td>{r.assignee ? names.name(r.assignee) : <span className="muted">غير مسندة</span>}</td>
              <td className="nowrap"><Link className="btn primary small" href={`/cycle/${r.ents[0].id}`}><Icon.phone /> المكالمة واستكمال البيانات</Link></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
