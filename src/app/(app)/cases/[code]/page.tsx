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
import { recvMissing } from "@/lib/recv";
import { Tabs } from "@/components/Tabs";

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
  const lines = decs.flatMap((d) => d.lines.map((l) => ({ d, l })));
  const miss = recvMissing(c);
  const kv = (l: string, v: React.ReactNode) => <div><span>{l}</span>{v || "—"}</div>;
  return (
    <>
      <PageHead title={c.name} sub={<><span className="num">{c.code}</span> · {c.dataConfirmed ? <Badge tone="ok">بيانات مؤكدة</Badge> : <Badge tone="warn">بيانات غير مؤكدة</Badge>} · {miss.length ? <Badge tone="warn">بيانات استلام ناقصة</Badge> : <Badge tone="ok">بيانات الاستلام مكتملة</Badge>}</>}>
        {can(u.role, "case") && <Link className="btn secondary" href={`/cases/${encodeURIComponent(code)}/edit`}>تعديل البيانات</Link>}
        {can(u.role, "op") && <Link className="btn secondary" href={`/ops?code=${encodeURIComponent(code)}#new`}><Icon.plus /> عملية</Link>}
        {can(u.role, "decision") && <Link className="btn primary" href={`/decisions/new?code=${encodeURIComponent(code)}`}><Icon.plus /> قرار</Link>}
      </PageHead>
      {saved && <div className="alert ok"><Icon.check />تم الحفظ.</div>}
      {dups.length > 0 && <div className="alert warn"><Icon.alert /><span>بيانات مشتركة مع حالات أخرى (راجع احتمال التكرار): {dups.map((d, i) => <span key={i}>{i ? " · " : ""}{d.field}: {d.codes.map((x, j) => <span key={x}>{j ? "، " : ""}<a className="strong" href={`/cases/${encodeURIComponent(x)}`}>{x}</a></span>)}</span>)}</span></div>}
      <div className="kpis">
        <Kpi v={decs.filter((d) => status(d) === "active").length} l="قرارات مستمرة" />
        <Kpi v={ents.length} l="استحقاقات" />
        <Kpi v={money(totalTr)} l="إجمالي المحوّل" />
        <Kpi v={money(totalRef)} l="المسترد" tone={totalRef ? "warn" : ""} />
        <Kpi v={money(totalTr - totalRef)} l="صافي المصروف" tone="ok" />
        <Kpi v={ops.length} l="عمليات" />
      </div>

      <Tabs tabs={[{ key: "data", label: "البيانات الأولية والاستلام" }, { key: "decisions", label: "القرارات والخدمات", count: lines.length }, { key: "pay", label: "الصرف", count: ents.length }, { key: "ops", label: "العمليات والسجل", count: ops.length + changes.length }, { key: "files", label: "المرفقات", count: files.length }]}>
      <div className="grid2">
        <div className="card">
          <div className="card-title"><h2>البيانات الأولية</h2><span className="muted">من السيستم مع تسجيل الكود</span></div>
          <div className="kv">
            {kv("الجنسية", c.nationality)}{kv("الديانة", c.religion)}{kv("النوع", c.gender)}{kv(c.birthDate ? "الميلاد" : "السن", c.birthDate ? `${fmtDate(c.birthDate)} (${age(c.birthDate)} سنة)` : c.age ? `${c.age} سنة` : "")}{kv("عدد الأفراد", c.familySize)}
            {kv("المحافظة", c.governorate)}{kv("المنطقة", c.area)}{kv("العنوان", c.address)}{kv("هاتف", <span className="num">{[c.phone, c.phone2].filter(Boolean).join(" / ")}</span>)}{kv("رقم المفوضية", <span className="num">{c.unhcr}</span>)}
            {kv("سُجلت", `${fmtTs(c.createdAt)} · ${names.name(c.createdById)}`)}
          </div>
          {c.description && <p style={{ marginTop: 12 }}>{c.description}</p>}{c.notes && <p className="muted" style={{ marginTop: 6 }}>{c.notes}</p>}
        </div>
        <div className="card">
          <div className="card-title"><h2>بيانات الاستلام</h2>{miss.length ? <Badge tone="warn">ناقصة</Badge> : <Badge tone="ok">مكتملة</Badge>}</div>
          <div className="kv">
            {kv("اسم المستلم", c.recvName || <span className="miss">ناقص</span>)}{kv("الرقم القومي", c.recvIdNo ? <><span className="num">{c.recvIdNo}</span>{c.idExpiry && <span className="cell-sub">ينتهي {c.idExpiry}</span>}</> : <span className="miss">ناقص</span>)}
            {kv("طريقة الاستلام", c.recvMethod || <span className="miss">ناقص</span>)}{kv("رقم الاستلام / المحفظة", <span className="num">{c.recvPhone}</span>)}{kv("الفرع / مكتب البريد", c.recvBranch)}
            {kv("موقف الإقامة", c.residencyStatus || <span className="miss">ناقص</span>)}{kv("انتهاء الإقامة", c.residencyExpiry)}
          </div>
          {miss.length > 0 && <p className="muted" style={{ marginTop: 12 }}>الناقص: <b>{miss.join("، ")}</b>. بيتحدد في مكالمة التأكيد أو من «تعديل البيانات».</p>}
        </div>
      </div>
      <div className="card">
        <Table wide heads={["القرار", "الخدمة", "نص القرار", "القيمة", "البداية", "النهاية", "المدة", "الحالة", "التجديد", ""]} empty="لا توجد قرارات.">
          {lines.map(({ d, l }, i) => {
            const stt = status(d);
            const first = i === 0 || lines[i - 1].d.id !== d.id;
            return (
              <tr key={l.id} className={first && i ? "group-start" : undefined}>
                <td className="nowrap">{first && <><Link className="strong" href={`/decisions/${d.id}`}>{d.no}</Link><span className="cell-sub">{fmtDate(d.issueDate)} · {d.renewOfId ? "مجدد" : "جديد"}</span><span className="cell-sub">{names.name(d.createdById)}</span></>}</td>
                <td className="nowrap">{l.service.name}{l.beneficiary && <span className="cell-sub">المستفيد: {l.beneficiary}</span>}{l.category && <span className="cell-sub">{l.category}</span>}</td>
                <td className="clip" title={d.text || undefined}><div className="clamp">{first ? d.text || "—" : <span className="muted">نفس القرار</span>}</div>{first && d.donor && <span className="cell-sub">المتبرع: {d.donor}</span>}</td>
                <td className="nowrap">{money(l.amount)} ج</td>
                <td className="nowrap date-cell">{fmtMonth(l.startMonth)}</td>
                <td className="nowrap date-cell">{fmtMonth(l.endMonth)}{l.extendedBy ? <span className="cell-sub">مُدد {l.extendedBy}</span> : null}</td>
                <td className="nowrap">{l.months} شهر{l.stoppedAt && <span className="cell-sub"><Badge tone="bad">الخدمة اتقفلت</Badge> {l.stopReason}</span>}</td>
                <td className="nowrap">{first && <><Badge tone={stt === "active" ? "ok" : stt === "ended" ? "" : "bad"}>{DEC_STATUS_LABELS[stt]}</Badge>{d.stopReason && <span className="cell-sub">{d.stopReason}</span>}{d.needsDonation && <span className="cell-sub"><Badge tone="warn">تحتاج لتبرع</Badge></span>}</>}</td>
                <td>{first && (d.renewalStatus !== "none" ? <Badge tone="info">{RENEWAL_LABELS[d.renewalStatus]}</Badge> : "—")}</td>
                <td>{first && can(u.role, "decision") && <Link className="btn secondary small" href={`/decisions/new?renew=${d.id}`}>تجديد</Link>}</td>
              </tr>
            );
          })}
        </Table>
      </div>

      <div className="card">
        <Table heads={["الشهر", "الخدمة", "القيمة", "الموقف", "التحويل", "مسترد", "وصل للمستفيد", "المتابعة"]} empty="لا توجد استحقاقات.">
          {ents.map((e) => (
            <tr key={e.id}>
              <td><Link className="strong" href={`/cycle/${e.id}`}>{fmtMonth(e.month)}</Link></td>
              <td>{e.serviceName}{e.line.beneficiary && <span className="cell-sub">المستفيد: {e.line.beneficiary}</span>}</td><td>{money(e.amountN)}</td>
              <td><StageBadge stage={e.stage} kind={e.kind} /></td>
              <td>{e.transfer ? <>{e.transfer.method}<span className="cell-sub num">{e.transfer.ref}</span></> : e.legacySent ? "محوّل (نظام سابق)" : "—"}</td>
              <td>{e.refundTotal ? money(e.refundTotal) : "—"}</td><td>{money(e.received)}</td>
              <td>{e.attempts.length}/3</td>
            </tr>
          ))}
        </Table>
      </div>

      <div className="grid2">
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
      <Attachments items={files} names={names} caseCode={code} canAdd={can(u.role, "case")} />
      </Tabs>
    </>
  );
}
