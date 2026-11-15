import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { loadEnts } from "@/lib/entitlements";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { DEC_STATUS_LABELS, RENEWAL_LABELS } from "@/lib/constants";
import { age, fmtDate, fmtTs, money } from "@/lib/format";
import { currentMonth, fmtMonth } from "@/lib/months";
import { Badge, Kpi, PageHead, StageBadge, Table } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Attachments } from "@/components/Attachments";
import { findDuplicates } from "@/lib/duplicates";

export default async function CaseFilePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ saved?: string }> }) {
  const u = await requirePageUser();
  const code = decodeURIComponent((await params).code);
  const { saved } = await searchParams;
  const c = await prisma.case.findUnique({ where: { code } });
  if (!c) notFound();
  const st = await getSettings();
  const [decs, ents, ops, changes, names, files] = await Promise.all([
    prisma.decision.findMany({ where: { caseCode: code }, include: { lines: { include: { service: true } } }, orderBy: { issueDate: "desc" } }),
    loadEnts({ caseCode: code }, st.followDays, [{ month: "desc" }]),
    prisma.operation.findMany({ where: { caseCode: code }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.caseChange.findMany({ where: { caseCode: code }, orderBy: { createdAt: "desc" } }),
    userNames(),
    prisma.attachment.findMany({ where: { OR: [{ caseCode: code }, { entitlement: { caseCode: code } }, { operation: { caseCode: code } }] }, orderBy: { createdAt: "desc" } }),
  ]);
  const dups = await findDuplicates(code, c);
  const totalTr = ents.reduce((s, e) => s + e.transferred, 0), totalRef = ents.reduce((s, e) => s + e.refundTotal, 0);
  const cm = currentMonth();
  const decEnd = (d: (typeof decs)[number]) => d.lines.reduce((m, l) => (l.endMonth > m ? l.endMonth : m), "");
  const status = (d: (typeof decs)[number]) => (d.status === "active" && decEnd(d) < cm ? "ended" : d.status);
  const kv = (l: string, v: React.ReactNode) => <div><span>{l}</span>{v || "—"}</div>;
  return (
    <>
      <PageHead title={c.name} sub={<><span className="num">{c.code}</span> · {c.dataConfirmed ? <Badge tone="ok">بيانات مؤكدة</Badge> : <Badge tone="warn">بيانات غير مؤكدة</Badge>}</>}>
        {can(u.role, "case") && <Link className="btn secondary" href={`/cases/${encodeURIComponent(code)}/edit`}>تعديل البيانات</Link>}
        {can(u.role, "op") && <Link className="btn secondary" href={`/ops?code=${encodeURIComponent(code)}#new`}><Icon.plus /> عملية</Link>}
        {can(u.role, "decision") && <Link className="btn primary" href={`/decisions/new?code=${encodeURIComponent(code)}`}><Icon.plus /> قرار</Link>}
      </PageHead>
      {saved && <div className="alert ok"><Icon.check />تم الحفظ.</div>}
      {dups.length > 0 && <div className="alert warn"><Icon.alert /><span>بيانات مشتركة مع حالات أخرى (راجع احتمال التكرار): {dups.map((d, i) => <span key={i}>{i ? " · " : ""}{d.field}: {d.codes.map((x, j) => <span key={x}>{j ? "، " : ""}<a className="strong" href={`/cases/${encodeURIComponent(x)}`}>{x}</a></span>)}</span>)}</span></div>}
      <div className="card">
        <div className="kv">
          {kv("الجنسية", c.nationality)}{kv("النوع", c.gender)}{kv("الميلاد", c.birthDate ? `${fmtDate(c.birthDate)} (${age(c.birthDate)} سنة)` : "")}{kv("عدد الأفراد", c.familySize)}
          {kv("المحافظة", c.governorate)}{kv("العنوان", c.address)}{kv("هاتف", <span className="num">{[c.phone, c.phone2].filter(Boolean).join(" / ")}</span>)}{kv("رقم المفوضية", <span className="num">{c.unhcr}</span>)}
          {kv("طريقة الاستلام", c.recvMethod)}{kv("المستلم", c.recvName)}{kv("رقم الاستلام", <span className="num">{c.recvPhone}</span>)}{kv("إثبات الشخصية", <span className="num">{c.recvIdNo}</span>)}
          {kv("الفرع / مكتب البريد", c.recvBranch)}{kv("سُجلت", `${fmtTs(c.createdAt)} · ${names.name(c.createdById)}`)}
        </div>
        {c.notes && <p className="muted" style={{ marginTop: 10 }}>{c.notes}</p>}
      </div>
      <div className="kpis" style={{ marginTop: 14 }}>
        <Kpi v={decs.filter((d) => status(d) === "active").length} l="قرارات مستمرة" />
        <Kpi v={ents.length} l="استحقاقات" />
        <Kpi v={money(totalTr)} l="إجمالي المحوّل" />
        <Kpi v={money(totalRef)} l="المسترد" tone={totalRef ? "warn" : ""} />
        <Kpi v={money(totalTr - totalRef)} l="صافي المصروف" tone="ok" />
        <Kpi v={ops.length} l="عمليات" />
      </div>

      <div className="section-title"><h2>القرارات</h2></div>
      <div className="card">
        <Table heads={["رقم", "تاريخ القرار", "الخدمات", "الحالة", "التجديد", ""]} empty="لا توجد قرارات.">
          {decs.map((d) => (
            <tr key={d.id}>
              <td className="nowrap"><Link className="strong" href={`/decisions/${d.id}`}>{d.no}</Link><span className="cell-sub">{d.renewOfId ? "مجدد" : "جديد"}</span></td>
              <td>{fmtDate(d.issueDate)}<span className="cell-sub">{names.name(d.createdById)}</span></td>
              <td>{d.lines.map((l) => <div key={l.id} className="cell-sub" style={{ color: "var(--text-2)" }}>{l.service.name} · {money(l.amount)} ج · {fmtMonth(l.startMonth)} ← {fmtMonth(l.endMonth)}{l.extendedBy ? ` (مُدد ${l.extendedBy})` : ""}</div>)}</td>
              <td><Badge tone={status(d) === "active" ? "ok" : status(d) === "ended" ? "" : "bad"}>{DEC_STATUS_LABELS[status(d)]}</Badge>{d.stopReason && <span className="cell-sub">{d.stopReason}</span>}</td>
              <td>{d.renewalStatus !== "none" ? <Badge tone="info">{RENEWAL_LABELS[d.renewalStatus]}</Badge> : "—"}</td>
              <td>{can(u.role, "decision") && <Link className="btn secondary small" href={`/decisions/new?renew=${d.id}`}>تجديد</Link>}</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="section-title"><h2>الاستحقاقات والصرف</h2></div>
      <div className="card">
        <Table heads={["الشهر", "الخدمة", "القيمة", "الموقف", "التحويل", "مسترد", "وصل للمستفيد", "المتابعة"]} empty="لا توجد استحقاقات.">
          {ents.map((e) => (
            <tr key={e.id}>
              <td><Link className="strong" href={`/cycle/${e.id}`}>{fmtMonth(e.month)}</Link></td>
              <td>{e.serviceName}</td><td>{money(e.amountN)}</td>
              <td><StageBadge stage={e.stage} kind={e.kind} /></td>
              <td>{e.transfer ? <>{e.transfer.method}<span className="cell-sub num">{e.transfer.ref}</span></> : e.legacySent ? "محوّل (نظام سابق)" : "—"}</td>
              <td>{e.refundTotal ? money(e.refundTotal) : "—"}</td><td>{money(e.received)}</td>
              <td>{e.attempts.length}/3</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><h2>العمليات على الحالة</h2></div>
          <Table heads={["التنفيذ", "العملية", "المنفذ", "وقت التسجيل"]} empty="لا توجد عمليات.">
            {ops.map((o) => <tr key={o.id}><td className="nowrap">{fmtDate(o.date)}</td><td>{o.type}{o.result && <span className="cell-sub">{o.result}</span>}</td><td>{names.name(o.userId)}</td><td className="nowrap">{fmtTs(o.createdAt)}</td></tr>)}
          </Table>
        </div>
        <div className="card">
          <div className="card-title"><h2>سجل تعديل البيانات</h2></div>
          {changes.length ? (
            <ul className="timeline">
              {changes.map((ch) => (
                <li key={ch.id}><span className="t">{fmtTs(ch.createdAt)} · {names.name(ch.userId)} · {ch.source}</span>
                  <div className="chg">{(ch.diffs as { label: string; old: string; new: string }[]).map((d, i) => <div key={i}>{d.label}: <del>{d.old || "فارغ"}</del> ← <ins>{d.new || "فارغ"}</ins></div>)}</div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">لم تُعدّل البيانات منذ التسجيل.</p>}
        </div>
      </div>
      <div style={{ marginTop: 14 }}><Attachments items={files} names={names} caseCode={code} canAdd={can(u.role, "case")} /></div>
    </>
  );
}
