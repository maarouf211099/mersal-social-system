import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { DEC_STATUS_LABELS, GOVS, NATS, RECV_METHODS, RESIDENCY } from "@/lib/constants";
import { fmtMonth, monthOptions } from "@/lib/months";
import { age, money } from "@/lib/format";
import { recvMissing } from "@/lib/recv";
import { caseInclude, caseWhere, lineStatus, NONE, paySummary, readCaseFilter } from "@/lib/cases-list";
import { one, qs, type SP } from "@/lib/page";
import { Badge, PageHead } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import { CasesTabs } from "@/components/CasesTabs";

const PER = 50;

/** الحالات والقرارات في بند واحد: البيانات الأساسية + بيانات الاستلام + كل خدمة في القرارات (النص، البداية، النهاية) + ملخص الصرف */
export default async function CasesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const f = readCaseFilter((k) => one(sp[k]));
  const { q, gov, nat, data, status, svc, donation, start, end, res, recv } = f;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { where, lineWhere, hasLineFilter, cm } = caseWhere(f);
  const [total, rows, services] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({ where, skip: (page - 1) * PER, take: PER, orderBy: { code: "asc" }, include: caseInclude(hasLineFilter ? lineWhere : undefined) }),
    prisma.service.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  const { byCase } = await paySummary(rows.map((c) => c.code));
  const pages = Math.ceil(total / PER);
  const filt = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const months = monthOptions(cm, 36, 24);
  const anyFilter = Object.keys(filt).length > 0;

  return (
    <>
      <PageHead title="الحالات والقرارات" sub="البيانات الأساسية وبيانات الاستلام وكل قرار بخدمته ونصه وبدايته ونهايته وملخص الصرف">
        {can(u.role, "case") && <Link className="btn secondary" href="/cases/new"><Icon.plus /> حالة جديدة</Link>}
        {can(u.role, "decision") && <Link className="btn primary" href="/decisions/new"><Icon.plus /> قرار جديد</Link>}
      </PageHead>
      <CasesTabs current="cases" />
      <form className="toolbar filters">
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف، رقم قومي، اسم المستلم، رقم قرار" /></label>
        <label className="field"><span>بداية القرار</span><AutoSubmitSelect name="start" defaultValue={start}><option value="">الكل</option>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>نهاية القرار</span><AutoSubmitSelect name="end" defaultValue={end}><option value="">الكل</option>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>حالة القرار</span><AutoSubmitSelect name="status" defaultValue={status}><option value="">الكل</option>{Object.entries(DEC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الخدمة</span><AutoSubmitSelect name="svc" defaultValue={svc}><option value="">الكل</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>موقف الإقامة</span><AutoSubmitSelect name="res" defaultValue={res}><option value="">الكل</option>{RESIDENCY.map((x) => <option key={x}>{x}</option>)}<option value={NONE}>غير مسجل</option></AutoSubmitSelect></label>
        <label className="field"><span>طريقة الاستلام</span><AutoSubmitSelect name="recv" defaultValue={recv}><option value="">الكل</option>{RECV_METHODS.map((x) => <option key={x}>{x}</option>)}<option value={NONE}>غير مسجلة</option></AutoSubmitSelect></label>
        <label className="field"><span>بيانات الاستلام</span><AutoSubmitSelect name="data" defaultValue={data}><option value="">الكل</option><option value="missing">ناقصة</option><option value="ok">مكتملة</option></AutoSubmitSelect></label>
        <label className="field"><span>المحافظة</span><AutoSubmitSelect name="gov" defaultValue={gov}><option value="">الكل</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الجنسية</span><AutoSubmitSelect name="nat" defaultValue={nat}><option value="">الكل</option>{NATS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>التمويل</span><AutoSubmitSelect name="donation" defaultValue={donation}><option value="">الكل</option><option value="1">تحتاج لتبرع</option></AutoSubmitSelect></label>
        <div className="auto inline">
          <button className="btn secondary">بحث</button>
          {anyFilter && <Link className="btn secondary" href="/cases">مسح الفلاتر</Link>}
        </div>
      </form>
      <div className="toolbar" style={{ alignItems: "center" }}>
        <span className="muted"><b>{total.toLocaleString("en-US")}</b> حالة {anyFilter ? "بالفلاتر دي" : ""}</span>
        <span className="spacer" />
        {total > 0 && <a className="btn secondary" href={`/api/export/cases${qs({ ...filt, format: "xlsx" })}`} title="كل بيانات الحالة (حتى اللي مش ظاهرة هنا) + كل قرار وخدمة + ملخص الصرف"><Icon.download /> تصدير Excel (كل البيانات)</a>}
      </div>
      <div className="card">
        {rows.length === 0 ? <div className="empty">{total || anyFilter ? "لا نتائج بهذه الفلاتر." : "لا توجد حالات بعد. سجّل أول قرار من «قرار جديد» وهيتسجل الكود تلقائياً."}</div> : (
          <div className="table-wrap wide">
            <table className="grouped">
              <thead><tr><th>الحالة</th><th>البيانات الأساسية</th><th>بيانات الاستلام</th><th>الخدمة</th><th>نص القرار</th><th>القيمة</th><th>البداية</th><th>النهاية</th><th>حالة القرار</th><th>الصرف</th></tr></thead>
              {rows.map((c) => {
                const lines = c.decisions.flatMap((d) => d.lines.map((l) => ({ d, l })));
                const span = Math.max(1, lines.length);
                const miss = recvMissing(c);
                const s = byCase.get(c.code);
                const ageV = c.birthDate ? age(c.birthDate) : c.age;
                const caseCells = (
                  <>
                    <td rowSpan={span} className="nowrap"><Link className="strong" href={`/cases/${encodeURIComponent(c.code)}`}><span className="num">{c.code}</span><span className="cell-sub" style={{ color: "var(--text)" }}>{c.name}</span></Link>{c.dataConfirmed && <span className="cell-sub"><Badge tone="ok">مؤكدة</Badge></span>}</td>
                    <td rowSpan={span} className="info-cell">
                      <div>{[c.nationality, c.religion, c.gender, ageV != null && `${ageV} سنة`].filter(Boolean).join(" · ") || "—"}</div>
                      {(c.governorate || c.area) && <div>{[c.governorate, c.area].filter(Boolean).join(" · ")}</div>}
                      {c.address && <div className="muted clamp" title={c.address}>{c.address}</div>}
                      <div className="num">{[c.phone, c.phone2].filter(Boolean).join(" / ") || "بدون هاتف"}</div>
                      {(c.unhcr || c.familySize) && <div className="muted">{[c.unhcr && `مفوضية ${c.unhcr}`, c.familySize && `${c.familySize} أفراد`].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td rowSpan={span} className="info-cell">
                      {miss.length ? <Badge tone="warn">ناقصة</Badge> : <Badge tone="ok">مكتملة</Badge>}
                      <div>{c.recvName || <span className="miss">المستلم ناقص</span>}</div>
                      <div>{c.recvIdNo ? <span className="num">{c.recvIdNo}</span> : <span className="miss">الرقم القومي ناقص</span>}</div>
                      <div>{c.recvMethod || <span className="miss">طريقة الاستلام ناقصة</span>}</div>
                      {c.recvPhone && <div className="num muted">{c.recvPhone}</div>}
                      <div>{c.residencyStatus || <span className="miss">الإقامة ناقصة</span>}{c.residencyExpiry && <span className="muted"> · حتى {c.residencyExpiry}</span>}</div>
                    </td>
                  </>
                );
                const tailCells = (
                  <td rowSpan={span} className="nowrap">{s?.n ? <>{s.n} مرة<span className="cell-sub">آخر صرف {fmtMonth(s.last)}</span>{s.tr > 0 && <span className="cell-sub">محوّل {money(s.tr)} ج</span>}</> : <span className="muted">لم يُصرف بعد</span>}</td>
                );
                return (
                  <tbody key={c.code}>
                    {lines.length === 0 ? (
                      <tr>{caseCells}<td colSpan={6} className="muted">لا توجد قرارات{hasLineFilter ? " بهذه الفلاتر" : ""}</td>{tailCells}</tr>
                    ) : lines.map(({ d, l }, i) => {
                      const st = l.stoppedAt ? "stopped" : lineStatus(d.status, l.endMonth, cm);
                      return (
                        <tr key={l.id}>
                          {i === 0 && caseCells}
                          <td className="nowrap">{l.service.name}{l.beneficiary && <span className="cell-sub">المستفيد: {l.beneficiary}</span>}{l.category && <span className="cell-sub">{l.category}</span>}</td>
                          <td className="clip" title={d.text || undefined}><div className="clamp">{d.text || "—"}</div><span className="cell-sub"><Link href={`/decisions/${d.id}`}>قرار {d.no}</Link></span></td>
                          <td className="nowrap">{money(l.amount)} ج</td>
                          <td className="nowrap date-cell">{fmtMonth(l.startMonth)}</td>
                          <td className="nowrap date-cell">{fmtMonth(l.endMonth)}{l.extendedBy > 0 && <span className="cell-sub">مُدد {l.extendedBy}</span>}</td>
                          <td className="nowrap"><Badge tone={st === "active" ? "ok" : st === "ended" ? "" : "bad"}>{DEC_STATUS_LABELS[st]}</Badge>{d.needsDonation && <span className="cell-sub"><Badge tone="warn">تحتاج لتبرع</Badge></span>}</td>
                          {i === 0 && tailCells}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="pager">
          <span className="muted">صفحة {page} من {pages}</span>
          {page > 1 && <Link className="btn secondary small" href={`/cases${qs({ ...filt, page: String(page - 1) })}`}>السابق</Link>}
          {page < pages && <Link className="btn secondary small" href={`/cases${qs({ ...filt, page: String(page + 1) })}`}>التالي</Link>}
        </div>
      )}
    </>
  );
}
