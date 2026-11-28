import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { lastMonths, metrics, staffStats, trends } from "@/lib/metrics";
import { STAGES, type Stage } from "@/lib/stage";
import { KIND_LABELS } from "@/lib/constants";
import { addMonths, currentMonth, fmtMonth, MONTH_NAMES } from "@/lib/months";
import { money } from "@/lib/format";
import { monthOf, monthOpts, one, type SP } from "@/lib/page";
import { Kpi, PageHead, StageBadge, Table, Trend } from "@/components/ui";
import { MonthSelect } from "@/components/client";
import { StaffTable } from "@/components/StaffTable";
import { Icon } from "@/components/icons";
import { noReplyDecisionIds } from "@/lib/noreply";

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp);
  const st = await getSettings();
  const cm = currentMonth();
  const [M, staff, names, pendingRef, renewSoon, endedOpen, trendM] = await Promise.all([
    metrics(m, {}, st.followDays), staffStats(m), userNames(),
    prisma.refund.count({ where: { settlement: "pending" } }),
    prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decision: { status: "active", renewalStatus: "none" } }, _max: { endMonth: true } }),
    prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decision: { status: "active" } }, _max: { endMonth: true } }),
    trends(lastMonths(m)),
  ]);
  const soon = renewSoon.filter((g) => g._max.endMonth! >= cm && g._max.endMonth! <= addMonths(cm, st.renewLead)).length;
  const ended = endedOpen.filter((g) => g._max.endMonth! < cm).length;
  const alerts: [string, string, string][] = [];
  if (M.stages.missing) alerts.push(["bad", `${M.stages.missing} استحقاق بيانات الاستلام بتاعه ناقصة — مش هيتبعت لحد ما يكمل`, `/data?m=${m}`]);
  if (M.lateNow) alerts.push(["bad", `${M.lateNow} مهمة متأخرة عن موعدها`, "/tasks?view=late"]);
  if (soon) alerts.push(["warn", `${soon} قرار ينتهي خلال ${st.renewLead} شهر ولم يُرسل للتجديد`, "/renewal"]);
  if (ended) alerts.push(["bad", `${ended} قرار انتهت مدته وينتظر الإغلاق`, "/renewal?view=ended"]);
  const noReply = (await noReplyDecisionIds()).size;
  if (noReply) alerts.push(["bad", `${noReply} قرار عليه عدم رد لشهرين متتاليين`, "/renewal?view=noreply"]);
  if (pendingRef) alerts.push(["warn", `${pendingRef} استرداد لم تتم تسويته`, "/refunds?all=1&settle=pending"]);
  const sc = (...ks: Stage[]) => ks.reduce((a, k) => a + (M.stages[k] ?? 0), 0);
  const flow = [
    { l: "استكمال البيانات", v: sc("missing", "needconf"), s: "بيانات الاستلام ناقصة", href: `/data?m=${m}`, tone: sc("missing", "needconf") ? "bad" : "" },
    { l: "جاهز للإرسال", v: sc("due", "conf"), s: "بياناته كاملة ومستني الدفعة", href: `/cycle?m=${m}`, tone: "warn" },
    { l: "في المتابعة", v: sc("sent", "trans", "wait", "noans"), s: "اتبعت ومستني تأكيد الاستلام", href: `/follow?m=${m}`, tone: "info" },
    { l: "استلم واكتمل", v: sc("recv", "deliv"), s: "الشهر اتقفل للحالة", href: `/follow?m=${m}&view=done`, tone: "ok" },
    { l: "لم يُصرف / متعثر", v: sc("notpaid", "stuck", "refund"), s: "محتاج معالجة أو غلق", href: "/closing", tone: sc("notpaid", "stuck", "refund") ? "bad" : "" },
  ];
  const flowTotal = flow.reduce((a, f) => a + f.v, 0);
  const todo = sc("missing", "needconf", "due", "conf", "sent", "trans", "wait", "noans");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hour12: false }).format(new Date()));
  const greet = hour < 12 ? "صباح الخير" : "مساء الخير";
  const myOpen = await prisma.task.count({ where: { assigneeId: u.id, status: { in: ["new", "in_progress"] } } });
  const tm = trendM.map((x) => ({ m: x.m, label: MONTH_NAMES[Number(x.m.slice(5)) - 1] }));
  return (
    <>
      <section className="hero-card">
        <div className="hc-main">
          <span className="hc-kicker">{greet} · {fmtMonth(m)}</span>
          <h1>أهلاً {u.name.split(" ")[0]}</h1>
          <p>{todo ? `عندك ${todo.toLocaleString("en-US")} حاجة مستنية شغل في دورة ${fmtMonth(m)}.` : `دورة ${fmtMonth(m)} ماشية — مفيش حاجة متأخرة.`}</p>
          <div className="hc-month"><MonthSelect value={m} options={monthOpts(m)} /></div>
        </div>
        <nav className="hc-actions" aria-label="اختصارات">
          {can(u, "decision") && <Link href="/decisions/new"><Icon.plus /><b>تسجيل كود وقرار</b><small>كود جديد أو قرار لحالة مسجلة</small></Link>}
          <Link href={`/data?m=${m}`}><Icon.user /><b>استكمال البيانات</b><small>{sc("missing", "needconf")} حالة ناقصة</small></Link>
          <Link href={`/cycle?m=${m}`}><Icon.wallet /><b>دورة الصرف</b><small>{sc("due", "conf")} جاهز للإرسال</small></Link>
          <Link href={`/follow?m=${m}`}><Icon.phone /><b>المتابعة</b><small>{sc("sent", "trans", "wait", "noans")} مستني تأكيد</small></Link>
          <Link href="/my"><Icon.inbox /><b>مهامي</b><small>{myOpen} مهمة مفتوحة</small></Link>
        </nav>
      </section>
      {sp && one(sp.denied) && <div className="alert bad"><Icon.alert />الصفحة المطلوبة غير متاحة لدورك.</div>}
      {alerts.length > 0 && <div className="alerts">{alerts.map(([t, msg, href]) => <div key={msg} className={`alert ${t}`}><span>{msg}</span><Link href={href}>فتح</Link></div>)}</div>}

      <div className="section-title"><h2>دورة {fmtMonth(m)}</h2><span className="muted">كل مرحلة بتسلّم للي بعدها — اضغط على أي مرحلة لفتحها</span></div>
      <div className="flow">
        {flow.map((f, i) => (
          <Link key={f.l} href={f.href} className={f.tone}>
            <span className="step"><i>{i + 1}</i>{f.l}</span>
            <span className="v">{f.v.toLocaleString("en-US")}</span>
            <span className="l">{f.s}</span>
            <span className="bar"><b style={{ width: `${flowTotal ? Math.round((f.v / flowTotal) * 100) : 0}%` }} /></span>
          </Link>
        ))}
      </div>

      <div className="section-title"><h2>مؤشرات التشغيل</h2><span className="muted">من سجل العمليات الفعلي</span></div>
      <div className="kpis">
        <Kpi v={M.opsTotal} l="إجمالي العمليات المنفذة" href={`/ops?m=${m}`} />
        <Kpi v={M.opsDone} l="عمليات مكتملة" tone="ok" />
        <Kpi v={M.opsOpen} l="عمليات غير مكتملة" tone={M.opsOpen ? "warn" : ""} href={`/ops?m=${m}&status=in_progress`} />
        <Kpi v={M.lateNow} l="مهام متأخرة الآن" tone={M.lateNow ? "bad" : ""} href="/tasks?view=late" />
        <Kpi v={M.followOps} l="عمليات متابعة" />
        <Kpi v={M.deliveryOps} l="عمليات تسليم" />
      </div>
      <div className="section-title"><h2>المؤشرات المالية</h2><span className="muted">الكفالات والمساعدات المالية</span></div>
      <div className="kpis">
        <Kpi v={money(M.due)} l="إجمالي المستحق (جنيه)" />
        <Kpi v={money(M.transferred)} l="إجمالي المحوّل" />
        <Kpi v={M.transferredCases} l="حالات تم التحويل لها" />
        <Kpi v={money(M.refunded)} l="إجمالي المسترد" tone={M.refunded ? "warn" : ""} href={`/refunds?m=${m}`} />
        <Kpi v={money(M.net)} l="صافي المصروف" tone="ok" />
        <Kpi v={M.notRecvFin} l="حالات لم تستلم مستحقاتها" tone={M.notRecvFin ? "bad" : ""} href={`/follow?m=${m}&view=noans`} />
      </div>
      <div className="section-title"><h2>مؤشرات الخدمات</h2></div>
      <div className="kpis">
        <Kpi v={M.activeCases} l="حالات نشطة" />
        <Kpi v={M.newDecs} l="قرارات جديدة" />
        <Kpi v={M.endingDecs} l="قرارات تنتهي هذا الشهر" href={`/renewal?view=ending&m=${m}`} s="اضغط للعرض والإغلاق" />
        <Kpi v={M.stoppedTotal} l="قرارات متوقفة" s={`${M.stoppedDecs} هذا الشهر`} />
        <Kpi v={M.referred} l="محالة للتجديد / إعادة البحث" href="/renewal?view=sent" />
        <Kpi v={M.beneficiaries} l="حالات استلمت الخدمة" tone="ok" />
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card"><div className="card-title"><h2>الخدمات المنفذة حسب النوع</h2></div>
          <Table heads={["الخدمة", "الفئة", "مستحق", "أُرسل", "اكتمل للمستفيد", "مفتوح", "القيمة"]} empty="لا استحقاقات لهذا الشهر. ولّدها من «دورة الصرف».">
            {M.bySvc.map(([n, b]) => <tr key={n}><td>{n}</td><td>{KIND_LABELS[b.kind as keyof typeof KIND_LABELS]}</td><td>{b.n}</td><td>{b.sent}</td><td>{b.done}</td><td>{b.open}</td><td>{money(b.amount)}</td></tr>)}
          </Table>
        </div>
        <div className="card"><div className="card-title"><h2>موقف الاستحقاقات حسب المرحلة</h2></div>
          <Table heads={["المرحلة", "العدد"]} empty="لا توجد استحقاقات.">
            {(Object.keys(STAGES) as Stage[]).filter((k) => M.stages[k]).map((k) => <tr key={k}><td><Link href={`/cycle?m=${m}&stage=${k}`}><StageBadge stage={k} /></Link></td><td>{M.stages[k]}</td></tr>)}
          </Table>
        </div>
      </div>
      <div className="section-title"><h2>مؤشرات الموظفين</h2><span className="muted">المسند = مهام أُسندت للموظف · نفّذ بنفسه = ما نفّذه فعلاً حتى لو كان مسنداً لغيره</span></div>
      <div className="card"><StaffTable rows={staff} names={names} m={m} /></div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card"><div className="card-title"><h2>صافي المصروف · آخر 6 شهور</h2></div><Trend months={tm} values={trendM.map((x) => x.net)} fmt={money} /></div>
        <div className="card"><div className="card-title"><h2>العمليات المنفذة · آخر 6 شهور</h2></div><Trend months={tm} values={trendM.map((x) => x.opsTotal)} /></div>
      </div>
    </>
  );
}
