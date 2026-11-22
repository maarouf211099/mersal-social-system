import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { prisma } from "@/lib/prisma";
import { cycleList } from "@/lib/cycle-list";
import { userNames } from "@/lib/users";
import { STAGES, canSend, type Stage } from "@/lib/stage";
import { RECV_METHODS } from "@/lib/constants";
import { fmtMonth } from "@/lib/months";
import { fmtTs, money } from "@/lib/format";
import { monthOf, monthOpts, one, qs, type SP } from "@/lib/page";
import { cycleBulk, generateMonth } from "@/actions/cycle";
import { Badge, PageHead, StageBadge, Table } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AutoSubmitSelect, MonthSelect, SelectAll } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";
import { Steps } from "@/components/Steps";

const KINDS = [{ key: "financial", label: "مالي" }, { key: "card", label: "كارت" }, { key: "in_kind", label: "عيني" }, { key: "service", label: "خدمات (سكن، علاج، متابعة)" }];

export default async function CyclePage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), kind = one(sp.kind) || "financial", stage = one(sp.stage) as Stage | "", q = one(sp.q).trim(), svc = one(sp.svc), data = one(sp.data);
  const [{ all, list: filtered }, services, batches, names] = await Promise.all([
    cycleList({ m, kind, svc, q, data }),
    prisma.service.findMany({ where: { kind: kind as any }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
    prisma.paymentBatch.findMany({ where: { month: m, kind: kind as any }, orderBy: { createdAt: "desc" } }),
    userNames(),
  ]);
  const counts: Partial<Record<Stage, number>> = {};
  filtered.forEach((e) => (counts[e.stage] = (counts[e.stage] ?? 0) + 1));
  const list = filtered.filter((e) => !stage || e.stage === stage);
  const missingN = all.filter((e) => e.stage === "missing").length;
  const deferredN = all.filter((e) => e.month !== m).length;
  const sendable = list.filter((e) => canSend(e.stage)).length;
  const transferable = list.filter((e) => e.kind === "financial" && e.sentAt && !e.transfer && !e.stoppedAt).length;
  const today = new Date().toISOString().slice(0, 10);
  const base = { m, kind, svc: svc || undefined, data: data || undefined, q: q || undefined };
  const exportHref = (extra: Record<string, string | undefined>) => `/api/export/cycle${qs({ ...base, stage: stage || undefined, ...extra, format: "xlsx" })}`;
  const svcName = services.find((s) => s.id === svc)?.name;
  return (
    <>
      <PageHead title="دورة الصرف" sub="اختار النوع والخدمة ← توليد الاستحقاقات ← تأكيد بيانات الاستلام ← الإرسال في دفعة ← التحويل ← المتابعة">
        <MonthSelect value={m} options={monthOpts(m)} />
        {can(u.role, "generate") && (
          <ActionForm action={generateMonth} className="inline"><input type="hidden" name="m" value={m} /><Submit className="btn secondary">توليد استحقاقات {fmtMonth(m)}</Submit></ActionForm>
        )}
      </PageHead>
      <div className="tabs" role="tablist">
        {KINDS.map((k) => <Link key={k.key} role="tab" href={`/cycle${qs({ m, kind: k.key })}`} aria-current={kind === k.key ? "page" : undefined}>{k.label}</Link>)}
      </div>
      <form className="toolbar">
        <input type="hidden" name="m" value={m} /><input type="hidden" name="kind" value={kind} />{stage && <input type="hidden" name="stage" value={stage} />}
        <label className="field" style={{ minWidth: 220 }}><span>الخدمة</span><AutoSubmitSelect name="svc" defaultValue={svc}><option value="">كل خدمات النوع</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>بيانات الاستلام</span><AutoSubmitSelect name="data" defaultValue={data}><option value="">الكل</option><option value="missing">ناقصة</option><option value="ok">مكتملة</option></AutoSubmitSelect></label>
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف، رقم قومي" /></label>
        <button className="btn secondary auto">بحث</button>
      </form>
      <div className="chips">
        <Link href={`/cycle${qs(base)}`} aria-current={!stage ? "page" : undefined}>الكل <b>{filtered.length}</b></Link>
        {(Object.keys(STAGES) as Stage[]).filter((s) => counts[s]).map((s) => <Link key={s} href={`/cycle${qs({ ...base, stage: s })}`} aria-current={stage === s ? "page" : undefined}>{STAGES[s].label} <b>{counts[s]}</b></Link>)}
      </div>
      {missingN > 0 && !data && <div className="alert warn"><Icon.alert /><span>{missingN} استحقاق بيانات الاستلام بتاعته ناقصة (الهاتف، اسم المستلم، الرقم القومي، موقف الإقامة أو تاريخ انتهائها) — مش هيتبعت لحد ما يكمل. <Link className="strong" href={`/data${qs({ m })}`}>«استكمال البيانات»</Link></span></div>}
      {deferredN > 0 && <div className="alert"><Icon.clock /><span>{deferredN} استحقاق مؤجل من شهور سابقة ما اتبعتش — ظاهر هنا بعلامة «مؤجل» وتقدر تبعته مع دفعة {fmtMonth(m)}.</span></div>}
      <ActionForm action={cycleBulk} resetOnOk>
        <input type="hidden" name="m" value={m} />
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 6 }}>
            <span className="muted">{svcName ?? KINDS.find((k) => k.key === kind)?.label} · {fmtMonth(m)} · <b>{list.length}</b> استحقاق · الإجمالي <b>{money(list.reduce((s, e) => s + e.amountN, 0))}</b> جنيه</span>
            <span className="spacer" />
            {list.length > 0 && <a className="btn secondary" href={exportHref({})}><Icon.download /> تصدير Excel</a>}
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
          <Table wide heads={[<SelectAll key="a" name="ids" />, "الكود", "الاسم", "رقم الهاتف", "اسم المستلم", "الرقم القومي", "موقف الإقامة", "انتهاء الإقامة", "الخدمة", "التكلفة", "القرار", "بداية القرار", "نهاية القرار", "البيانات", "الموقف"]}
            empty={all.length ? "لا استحقاقات بهذه الفلاتر." : `لم تُولَّد استحقاقات ${fmtMonth(m)} لهذا النوع بعد. اضغط «توليد استحقاقات ${fmtMonth(m)}».`}>
            {list.slice(0, 800).map((e) => (
              <tr key={e.id} className={e.missing.length ? "row-warn" : undefined}>
                <td><input type="checkbox" name="ids" value={e.id} aria-label="تحديد" /></td>
                <td className="nowrap"><Link className="strong num" href={`/cases/${encodeURIComponent(e.caseCode)}`}>{e.caseCode}</Link>{e.month !== m && <span className="cell-sub"><Badge tone="warn">مؤجل من {fmtMonth(e.month)}</Badge></span>}</td>
                <td className="nowrap">{e.case.name}</td>
                <td><span className="num">{e.case.phone || "—"}</span></td>
                <td style={{ minWidth: 130 }}>{e.case.recvName || <Miss />}{e.case.recvMethod && <span className="cell-sub">{e.case.recvMethod}{e.case.recvPhone ? ` · ${e.case.recvPhone}` : ""}</span>}</td>
                <td>{e.case.recvIdNo ? <span className="num">{e.case.recvIdNo}</span> : <Miss />}</td>
                <td className="nowrap">{e.case.residencyStatus || <Miss />}</td>
                <td className="nowrap">{e.case.residencyExpiry ? <span className="num">{e.case.residencyExpiry}</span> : "—"}</td>
                <td className="nowrap">{e.serviceName}{e.line.beneficiary && <span className="cell-sub">المستفيد: {e.line.beneficiary}</span>}{e.resendCount > 0 && <span className="cell-sub">أُعيد الإرسال ×{e.resendCount}</span>}</td>
                <td className="nowrap">{money(e.amountN)}{Number(e.carriedAmount) > 0 && <span className="cell-sub">+{money(e.carriedAmount)} مرحّل</span>}</td>
                <td className="clip" title={e.line.decision.text || undefined}><div className="clamp">{e.line.decision.text || "—"}</div><span className="cell-sub"><Link href={`/decisions/${e.line.decision.id}`}>{e.line.decision.no}</Link></span></td>
                <td className="nowrap">{fmtMonth(e.line.startMonth)}</td>
                <td className="nowrap">{fmtMonth(e.line.endMonth)}</td>
                <td style={{ minWidth: 150 }}>{e.missing.length ? <span title={e.missing.join("، ")}><Badge tone="warn">ناقصة</Badge><span className="cell-sub">{e.missing.join("، ")}</span></span> : <Badge tone="ok">مكتملة</Badge>}</td>
                <td className="stage-cell"><Link href={`/cycle/${e.id}`}><StageBadge stage={e.stage} kind={e.kind} /></Link><Steps e={e} />{e.sentAt && <span className="cell-sub">أُرسل {fmtTs(e.sentAt)} · {names.name(e.sentById)}</span>}{e.transfer && <span className="cell-sub">{e.transfer.method} · <span className="num">{e.transfer.ref}</span></span>}</td>
              </tr>
            ))}
          </Table>
          {list.length > 800 && <p className="muted" style={{ marginTop: 26 }}>يُعرض أول 800 في الشاشة — شيت الإكسيل فيه الكل ({list.length}).</p>}
        </div>
      </ActionForm>

      <div className="section-title"><h2>دفعات {fmtMonth(m)}</h2><span className="muted">نسخة Excel من كل دفعة لإرسالها للحسابات</span></div>
      <div className="card">
        <Table heads={["الدفعة", "عدد الحالات", "الإجمالي", "أرسلها", "الوقت", ""]} empty="لم تُرسل دفعات لهذا النوع في هذا الشهر بعد.">
          {batches.map((b) => (
            <tr key={b.id}>
              <td><span className="num strong">{b.code}</span></td>
              <td>{b.count}</td><td className="nowrap">{money(b.total)} ج</td>
              <td>{names.name(b.userId)}</td><td className="nowrap">{fmtTs(b.createdAt)}</td>
              <td className="nowrap"><a className="btn secondary small" href={`/api/export/cycle${qs({ m, kind, batch: b.id, format: "xlsx" })}`}><Icon.download /> Excel الدفعة</a></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}

const Miss = () => <span className="miss">ناقص</span>;
