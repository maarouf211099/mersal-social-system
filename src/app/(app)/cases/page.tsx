import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { DEC_STATUS_LABELS, GOVS, NATS } from "@/lib/constants";
import { currentMonth, fmtMonth } from "@/lib/months";
import { money } from "@/lib/format";
import { recvMissing, RECV_MISSING_WHERE } from "@/lib/recv";
import { one, qs, type SP } from "@/lib/page";
import { Badge, PageHead } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";
import { CasesTabs } from "@/components/CasesTabs";

const PER = 50;

/** الحالات والقرارات في بند واحد: البيانات الأولية + كل خدمة في القرارات (النص، البداية، النهاية) + ملخص الصرف */
export default async function CasesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const q = one(sp.q).trim(), gov = one(sp.gov), nat = one(sp.nat), data = one(sp.data), status = one(sp.status), svc = one(sp.svc), donation = one(sp.donation);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const cm = currentMonth();
  // شرط القرار (لو فيه فلتر) — بيتطبق على الحالات وعلى الخدمات اللي بتظهر
  const lineWhere: Prisma.DecisionLineWhereInput = {
    AND: [
      ...(svc ? [{ serviceId: svc }] : []),
      ...(status === "active" ? [{ decision: { status: "active" as const }, endMonth: { gte: cm } }]
        : status === "ended" ? [{ OR: [{ decision: { status: "ended" as const } }, { decision: { status: "active" as const }, endMonth: { lt: cm } }] }]
        : status ? [{ decision: { status: status as any } }] : []),
      ...(donation === "1" ? [{ decision: { needsDonation: true } }] : []),
    ],
  };
  const hasLineFilter = !!(svc || status || donation);
  const where: Prisma.CaseWhereInput = {
    ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { recvPhone: { contains: q } }, { recvIdNo: { contains: q } }, { unhcr: { contains: q } }, { decisions: { some: { no: { contains: q } } } }] } : {}),
    ...(gov ? { governorate: gov } : {}), ...(nat ? { nationality: nat } : {}),
    ...(data === "missing" ? RECV_MISSING_WHERE : data === "ok" ? { NOT: RECV_MISSING_WHERE } : {}),
    ...(hasLineFilter ? { decisions: { some: { lines: { some: lineWhere } } } } : {}),
  };
  const [total, rows, services] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where, skip: (page - 1) * PER, take: PER, orderBy: { code: "asc" },
      include: { decisions: { include: { lines: { where: hasLineFilter ? lineWhere : undefined, include: { service: { select: { name: true } } }, orderBy: { endMonth: "desc" } } }, orderBy: { issueDate: "desc" } } },
    }),
    prisma.service.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  const codes = rows.map((c) => c.code);
  const [sent, transfers] = codes.length ? await Promise.all([
    prisma.entitlement.groupBy({ by: ["caseCode"], where: { caseCode: { in: codes }, OR: [{ sentAt: { not: null } }, { legacySent: true }] }, _count: { _all: true }, _max: { month: true } }),
    prisma.transfer.findMany({ where: { entitlement: { caseCode: { in: codes } } }, select: { amount: true, entitlement: { select: { caseCode: true } } } }),
  ]) : [[], []];
  const sentMap = new Map(sent.map((s) => [s.caseCode, { n: s._count._all, last: s._max.month }]));
  const trMap = new Map<string, number>();
  transfers.forEach((t) => trMap.set(t.entitlement.caseCode, (trMap.get(t.entitlement.caseCode) ?? 0) + Number(t.amount)));
  const pages = Math.ceil(total / PER);
  const filt = { q, gov, nat, data, status, svc, donation };
  const lineStatus = (d: { status: keyof typeof DEC_STATUS_LABELS }, end: string) => (d.status === "active" && end < cm ? "ended" : d.status);

  return (
    <>
      <PageHead title="الحالات والقرارات" sub={`${total.toLocaleString("en-US")} حالة · البيانات الأولية وكل قرار بخدمته ونصه وبدايته ونهايته وملخص الصرف`}>
        {can(u.role, "case") && <Link className="btn secondary" href="/cases/new"><Icon.plus /> حالة جديدة</Link>}
        {can(u.role, "decision") && <Link className="btn primary" href="/decisions/new"><Icon.plus /> قرار جديد</Link>}
      </PageHead>
      <CasesTabs current="cases" />
      <form className="toolbar">
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف، رقم قومي، رقم قرار" /></label>
        <label className="field"><span>حالة القرار</span><AutoSubmitSelect name="status" defaultValue={status}><option value="">الكل</option>{Object.entries(DEC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الخدمة</span><AutoSubmitSelect name="svc" defaultValue={svc}><option value="">الكل</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>بيانات الاستلام</span><AutoSubmitSelect name="data" defaultValue={data}><option value="">الكل</option><option value="missing">ناقصة</option><option value="ok">مكتملة</option></AutoSubmitSelect></label>
        <label className="field"><span>المحافظة</span><AutoSubmitSelect name="gov" defaultValue={gov}><option value="">الكل</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الجنسية</span><AutoSubmitSelect name="nat" defaultValue={nat}><option value="">الكل</option>{NATS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>التمويل</span><AutoSubmitSelect name="donation" defaultValue={donation}><option value="">الكل</option><option value="1">تحتاج لتبرع</option></AutoSubmitSelect></label>
        <button className="btn secondary auto">بحث</button>
      </form>
      <div className="card">
        {rows.length === 0 ? <div className="empty">{total || q || hasLineFilter ? "لا نتائج بهذه الفلاتر." : "لا توجد حالات بعد. سجّل أول قرار من «قرار جديد» وهيتسجل الكود تلقائياً."}</div> : (
          <div className="table-wrap wide">
            <table className="grouped">
              <thead><tr><th>الحالة</th><th>البيانات الأولية</th><th>الخدمة</th><th>نص القرار</th><th>القيمة</th><th>البداية</th><th>النهاية</th><th>حالة القرار</th><th>بيانات الاستلام</th><th>الصرف</th></tr></thead>
              {rows.map((c) => {
                const lines = c.decisions.flatMap((d) => d.lines.map((l) => ({ d, l })));
                const span = Math.max(1, lines.length);
                const miss = recvMissing(c);
                const s = sentMap.get(c.code), tr = trMap.get(c.code) ?? 0;
                const caseCells = (
                  <>
                    <td rowSpan={span} className="nowrap"><Link className="strong" href={`/cases/${encodeURIComponent(c.code)}`}><span className="num">{c.code}</span><span className="cell-sub" style={{ color: "var(--text)" }}>{c.name}</span></Link></td>
                    <td rowSpan={span}>{[c.nationality, c.governorate, c.area].filter(Boolean).join(" · ") || "—"}<span className="cell-sub num">{c.phone || "بدون هاتف"}</span></td>
                  </>
                );
                const tailCells = (
                  <>
                    <td rowSpan={span}>{miss.length ? <><Badge tone="warn">ناقصة</Badge><span className="cell-sub">{miss.join("، ")}</span></> : <><Badge tone="ok">مكتملة</Badge><span className="cell-sub">{c.recvMethod}</span></>}</td>
                    <td rowSpan={span} className="nowrap">{s ? <>{s.n} مرة<span className="cell-sub">آخر صرف {fmtMonth(s.last)}</span>{tr > 0 && <span className="cell-sub">محوّل {money(tr)} ج</span>}</> : <span className="muted">لم يُصرف بعد</span>}</td>
                  </>
                );
                return (
                  <tbody key={c.code}>
                    {lines.length === 0 ? (
                      <tr>{caseCells}<td colSpan={6} className="muted">لا توجد قرارات{hasLineFilter ? " بهذه الفلاتر" : ""}</td>{tailCells}</tr>
                    ) : lines.map(({ d, l }, i) => {
                      const st = lineStatus(d, l.endMonth);
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
