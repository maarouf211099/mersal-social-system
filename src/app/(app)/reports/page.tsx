import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { lastMonths, metrics, staffStats, type Filter, type Metrics } from "@/lib/metrics";
import { DEC_STATUS_LABELS, GOVS, KIND_LABELS, NATS } from "@/lib/constants";
import { addMonths, fmtMonth, MONTH_NAMES } from "@/lib/months";
import { fmtDate, fmtDur, fmtTs, money, pct } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { Badge, CaseLink, Kpi, PageHead, Seg, StageBadge, Table, Trend } from "@/components/ui";
import { AutoSubmitSelect, MonthSelect, PrintButton } from "@/components/client";
import { StaffTable } from "@/components/StaffTable";
import { Icon } from "@/components/icons";

const VIEWS = [{ key: "month", label: "التقرير الشهري" }, { key: "staff", label: "تقارير الموظفين" }, { key: "ops", label: "كل العمليات" }, { key: "compare", label: "مقارنة الشهور" }];

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), view = one(sp.view) || "month";
  const f: Filter = { staff: one(sp.staff) || undefined, svc: one(sp.svc) || undefined, dec: one(sp.dec) || undefined, gov: one(sp.gov) || undefined, nat: one(sp.nat) || undefined };
  const st = await getSettings();
  const [names, services] = await Promise.all([userNames(), prisma.service.findMany({ orderBy: { sort: "asc" } })]);
  const params = { m, view, staff: f.staff, svc: f.svc, dec: f.dec, gov: f.gov, nat: f.nat };
  const desc = [f.staff && `الموظف: ${names.name(f.staff)}`, f.svc && services.find((s) => s.id === f.svc)?.name, f.dec && `قرار ${DEC_STATUS_LABELS[f.dec as keyof typeof DEC_STATUS_LABELS]}`, f.gov, f.nat].filter(Boolean).join(" · ") || "كل البيانات";
  const exportKind = view === "month" ? "month" : view;
  return (
    <>
      <PageHead title="التقارير" sub={`${desc} · أُنشئ ${fmtTs(new Date())} بواسطة ${u.name}`}>
        <MonthSelect value={m} options={monthOpts(m)} />
        <Link className="btn secondary" href={`/api/export/${exportKind}${qs(params)}`}><Icon.download /> تصدير CSV</Link>
        <PrintButton />
      </PageHead>
      <div className="toolbar"><Seg current={view} items={VIEWS.map((v) => ({ ...v, href: `/reports${qs({ ...params, view: v.key })}` }))} /></div>
      <form className="toolbar no-print">
        <input type="hidden" name="m" value={m} /><input type="hidden" name="view" value={view} />
        <label className="field"><span>الموظف</span><AutoSubmitSelect name="staff" defaultValue={f.staff ?? ""}><option value="">الكل</option>{names.all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>نوع الخدمة</span><AutoSubmitSelect name="svc" defaultValue={f.svc ?? ""}><option value="">الكل</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>حالة القرار</span><AutoSubmitSelect name="dec" defaultValue={f.dec ?? ""}><option value="">الكل</option>{Object.entries(DEC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>المحافظة</span><AutoSubmitSelect name="gov" defaultValue={f.gov ?? ""}><option value="">الكل</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الجنسية</span><AutoSubmitSelect name="nat" defaultValue={f.nat ?? ""}><option value="">الكل</option>{NATS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
      </form>
      {view === "month" && <MonthReport m={m} f={f} followDays={st.followDays} names={names} />}
      {view === "staff" && <StaffReport m={m} f={f} names={names} />}
      {view === "ops" && <OpsReport m={m} f={f} names={names} />}
      {view === "compare" && <CompareReport m={m} f={f} followDays={st.followDays} />}
    </>
  );
}

type Names = Awaited<ReturnType<typeof userNames>>;

async function MonthReport({ m, f, followDays, names }: { m: string; f: Filter; followDays: number; names: Names }) {
  const [M, P, staff] = await Promise.all([metrics(m, f, followDays), metrics(addMonths(m, -1), f, followDays), staffStats(m, f)]);
  const k = (v: number, l: string, prev: number, isMoney = false, worse = false, tone = "") => {
    const d = v - prev;
    const good = worse ? d <= 0 : d >= 0;
    return <Kpi v={isMoney ? money(v) : v} l={l} tone={tone} s={`${d >= 0 ? "+" : ""}${isMoney ? money(d) : d} عن ${fmtMonth(P.m)}`} sTone={d === 0 ? "" : good ? "up" : "down"} />;
  };
  return (
    <>
      <div className="section-title"><h2>ملخص {fmtMonth(m)}</h2></div>
      <div className="kpis">
        {k(M.opsTotal, "عمليات تمت خلال الشهر", P.opsTotal)}
        {k(M.beneficiaries, "حالات مستفيدة (استلمت)", P.beneficiaries, false, false, "ok")}
        {k(M.ents.length, "خدمات مستحقة", P.ents.length)}
        {k(M.received, "خدمات اكتملت للمستفيد", P.received)}
        {k(M.notReceived, "خدمات لم تُستلم", P.notReceived, false, true, M.notReceived ? "bad" : "")}
        {k(M.opsOpen, "عمليات غير مكتملة", P.opsOpen, false, true, M.opsOpen ? "warn" : "")}
      </div>
      <div className="kpis">
        {k(M.due, "المستحق المالي", P.due, true)}
        {k(M.transferred, "المحوّل", P.transferred, true)}
        {k(M.refunded, "المسترد", P.refunded, true, true, M.refunded ? "warn" : "")}
        {k(M.net, "صافي المصروف", P.net, true, false, "ok")}
        {k(M.transferredCases, "حالات تم التحويل لها", P.transferredCases)}
        {k(M.notRecvFin, "حالات مالية لم تستلم", P.notRecvFin, false, true, M.notRecvFin ? "bad" : "")}
      </div>
      <div className="grid2">
        <div className="card"><div className="card-title"><h2>الخدمات المنفذة حسب النوع</h2></div>
          <Table heads={["الخدمة", "الفئة", "مستحق", "أُرسل", "اكتمل", "مفتوح", "القيمة"]} empty="لا يوجد.">
            {M.bySvc.map(([n, b]) => <tr key={n}><td>{n}</td><td>{KIND_LABELS[b.kind as keyof typeof KIND_LABELS]}</td><td>{b.n}</td><td>{b.sent}</td><td>{b.done}</td><td>{b.open}</td><td>{money(b.amount)}</td></tr>)}
          </Table>
        </div>
        <div className="card"><div className="card-title"><h2>أسباب التعثر وعدم الاستلام</h2></div>
          <Table heads={["السبب", "العدد"]} empty="لا توجد حالات تعثر.">{M.reasons.map(([r, n]) => <tr key={r}><td>{r}</td><td>{n}</td></tr>)}</Table>
        </div>
      </div>
      <div className="section-title"><h2>تقرير الموظفين</h2></div>
      <div className="card"><StaffTable rows={staff} names={names} m={m} /></div>
      <div className="section-title"><h2>العمليات غير المكتملة ({M.incomplete.length})</h2></div>
      <div className="card">
        <Table heads={["الحالة", "الخدمة", "الموقف", "آخر إجراء"]} empty="كل الخدمات مكتملة.">
          {M.incomplete.slice(0, 300).map((e) => <tr key={e.id}><td><CaseLink code={e.caseCode} name={e.case.name} /></td><td>{e.serviceName}</td><td><Link href={`/cycle/${e.id}`}><StageBadge stage={e.stage} kind={e.kind} /></Link></td><td className="nowrap">{fmtTs(e.attempts.at(-1)?.createdAt ?? e.transfer?.createdAt ?? e.sentAt ?? e.createdAt)}</td></tr>)}
        </Table>
      </div>
      <TrendBlock m={m} f={f} followDays={followDays} />
    </>
  );
}

async function TrendBlock({ m, f, followDays }: { m: string; f: Filter; followDays: number }) {
  const ms = lastMonths(m);
  const Ms: Metrics[] = await Promise.all(ms.map((x) => metrics(x, f, followDays)));
  const tm = ms.map((x) => ({ m: x, label: MONTH_NAMES[Number(x.slice(5)) - 1] }));
  return (
    <div className="grid2" style={{ marginTop: 14 }}>
      <div className="card"><div className="card-title"><h2>صافي المصروف</h2></div><Trend months={tm} values={Ms.map((x) => x.net)} fmt={money} /></div>
      <div className="card"><div className="card-title"><h2>حالات مستفيدة</h2></div><Trend months={tm} values={Ms.map((x) => x.beneficiaries)} /></div>
    </div>
  );
}

async function StaffReport({ m, f, names }: { m: string; f: Filter; names: Names }) {
  const [rows, prev] = await Promise.all([staffStats(m, f), staffStats(addMonths(m, -1), f)]);
  const [y, mo] = m.split("-").map(Number);
  return (
    <>
      <div className="section-title"><h2>مقارنة الإنتاجية · {fmtMonth(m)}</h2></div>
      <div className="card"><StaffTable rows={rows} names={names} m={m} /></div>
      {await Promise.all(rows.map(async (r) => {
        const p = prev.find((x) => x.uid === r.uid);
        const ops = await prisma.operation.findMany({ where: { userId: r.uid, date: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) } }, orderBy: { createdAt: "desc" }, take: 40 });
        return (
          <div className="card" key={r.uid} style={{ marginTop: 14 }}>
            <div className="card-title"><h2>{names.name(r.uid)}</h2><span className="muted">{fmtMonth(m)}</span></div>
            <div className="kpis">
              <Kpi v={r.assigned} l="مهام مسندة" s={`${p?.assigned ?? 0} الشهر السابق`} />
              <Kpi v={pct(r.assignedDone, r.assigned)} l="نسبة الإنجاز" />
              <Kpi v={r.doneBy} l="نفّذ بنفسه" tone="ok" s={`${p?.doneBy ?? 0} الشهر السابق`} />
              <Kpi v={r.ops} l="عمليات مسجلة" s={`${p?.ops ?? 0} الشهر السابق`} />
              <Kpi v={pct(r.opsDone, r.ops)} l="عمليات مكتملة" />
              <Kpi v={fmtDur(r.avgMs)} l="متوسط زمن التنفيذ" />
              <Kpi v={r.late} l="متأخرة" tone={r.late ? "bad" : ""} />
              <Kpi v={r.returned} l="أُرجعت للتصحيح" tone={r.returned ? "warn" : ""} />
              <Kpi v={r.weight} l="الإنتاجية بالأوزان" s={`${p?.weight ?? 0} الشهر السابق`} />
            </div>
            <div className="grid2">
              <Table heads={["نوع العملية", "العدد"]} flat empty="لا عمليات.">{r.byType.map(([t, n]) => <tr key={t}><td>{t}</td><td>{n}</td></tr>)}</Table>
              <Table heads={["التنفيذ", "العملية", "الحالة / الجهة", "النتيجة"]} flat empty="لا عمليات.">
                {ops.map((o) => <tr key={o.id}><td className="nowrap">{fmtDate(o.date)}</td><td>{o.type}{o.count > 1 ? ` ×${o.count}` : ""}</td><td>{o.caseCode ?? o.dept}</td><td className="cell-sub">{o.result}</td></tr>)}
              </Table>
            </div>
          </div>
        );
      }))}
      {!rows.length && <div className="empty">لا يوجد نشاط في هذا الشهر.</div>}
    </>
  );
}

async function OpsReport({ m, f, names }: { m: string; f: Filter; names: Names }) {
  const [y, mo] = m.split("-").map(Number);
  const ops = await prisma.operation.findMany({ where: { date: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) }, ...(f.staff ? { userId: f.staff } : {}), ...(f.gov || f.nat ? { OR: [{ caseCode: null }, { case: { ...(f.gov ? { governorate: f.gov } : {}), ...(f.nat ? { nationality: f.nat } : {}) } }] } : {}) }, orderBy: { createdAt: "desc" } });
  const by = new Map<string, { team: string; n: number; done: number; w: number }>();
  ops.forEach((o) => { const b = by.get(o.type) ?? { team: o.team, n: 0, done: 0, w: 0 }; b.n += o.count; if (o.status === "done") b.done += o.count; b.w += Number(o.weight) * o.count; by.set(o.type, b); });
  return (
    <>
      <div className="section-title"><h2>كل العمليات · {fmtMonth(m)}</h2><span className="muted">{ops.reduce((s, o) => s + o.count, 0)} عملية</span></div>
      <div className="card"><div className="card-title"><h2>ملخص حسب نوع العملية</h2></div>
        <Table heads={["نوع العملية", "الفريق", "العدد", "المكتمل", "الإنتاجية بالأوزان"]} empty="لا عمليات.">
          {[...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([t, b]) => <tr key={t}><td>{t}</td><td>{b.team}</td><td>{b.n}</td><td>{b.done}</td><td>{Math.round(b.w * 10) / 10}</td></tr>)}
        </Table>
      </div>
      <div className="card"><div className="card-title"><h2>السجل التفصيلي</h2></div>
        <Table heads={["التنفيذ", "العملية", "الحالة / الجهة", "النتيجة", "المنفذ", "وقت التسجيل", "الحالة"]} empty="لا عمليات.">
          {ops.slice(0, 800).map((o) => <tr key={o.id}><td className="nowrap">{fmtDate(o.date)}</td><td>{o.type}{o.count > 1 ? ` ×${o.count}` : ""}</td><td>{o.caseCode ?? o.dept}</td><td className="cell-sub">{o.result}</td><td>{names.name(o.userId)}</td><td className="nowrap">{fmtTs(o.createdAt)}</td><td><Badge tone={o.status === "done" ? "ok" : ""}>{o.status === "done" ? "تم" : o.status === "in_progress" ? "جاري" : "جديد"}</Badge></td></tr>)}
        </Table>
      </div>
    </>
  );
}

async function CompareReport({ m, f, followDays }: { m: string; f: Filter; followDays: number }) {
  const ms = lastMonths(m);
  const Ms = await Promise.all(ms.map((x) => metrics(x, f, followDays)));
  const def: [string, (x: Metrics) => number, boolean?][] = [
    ["عمليات منفذة", (x) => x.opsTotal], ["عمليات غير مكتملة", (x) => x.opsOpen], ["خدمات مستحقة", (x) => x.ents.length], ["حالات مستفيدة", (x) => x.beneficiaries],
    ["خدمات لم تُستلم", (x) => x.notReceived], ["المستحق المالي", (x) => x.due, true], ["المحوّل", (x) => x.transferred, true], ["المسترد", (x) => x.refunded, true],
    ["صافي المصروف", (x) => x.net, true], ["حالات نشطة", (x) => x.activeCases], ["قرارات جديدة", (x) => x.newDecs], ["قرارات تنتهي", (x) => x.endingDecs], ["محالة للتجديد", (x) => x.referred],
  ];
  return (
    <div className="card">
      <Table heads={["المؤشر", ...ms.map(fmtMonth)]}>
        {def.map(([l, fn, isMoney]) => (
          <tr key={l}><td>{l}</td>{Ms.map((x, i) => { const v = fn(x), p = i ? fn(Ms[i - 1]) : null; return <td key={i} className="nowrap">{isMoney ? money(v) : v}{p != null && p !== v && <span style={{ color: v > p ? "var(--ok)" : "var(--bad)", fontSize: 11 }}> {v > p ? "▲" : "▼"}</span>}</td>; })}</tr>
        ))}
      </Table>
    </div>
  );
}
